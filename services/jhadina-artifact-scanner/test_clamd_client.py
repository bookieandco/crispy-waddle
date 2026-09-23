import hashlib
import io
import struct
import unittest
from unittest.mock import patch

from clamd_client import ClamdClient, ClamdError, parse_scan_reply


class FakeSocket:
    def __init__(self, reply: bytes):
        self.reply = reply
        self.sent = bytearray()
        self.timeout = None

    def settimeout(self, value):
        self.timeout = value

    def connect(self, address):
        self.address = address

    def sendall(self, data):
        self.sent.extend(data)

    def recv(self, _size):
        data, self.reply = self.reply, b""
        return data

    def close(self):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        self.close()


class ClamdClientTest(unittest.TestCase):
    def test_parse_clean_and_infected(self):
        self.assertEqual(parse_scan_reply("stream: OK"), (False, None))
        self.assertEqual(parse_scan_reply("stream: Eicar-Signature FOUND"), (True, "Eicar-Signature"))
        with self.assertRaisesRegex(ClamdError, "CLAMD_SCAN_ERROR"):
            parse_scan_reply("stream: scan error ERROR")

    def test_instream_frames_bytes_and_hash(self):
        fake = FakeSocket(b"stream: OK\0")
        payload = b"hello-jhadina"
        with patch("clamd_client.socket.socket", return_value=fake):
            client = ClamdClient(host="clamd", chunk_bytes=5)
            result = client.scan_stream(io.BytesIO(payload))
        self.assertEqual(result.sha256, hashlib.sha256(payload).hexdigest())
        self.assertEqual(result.size_bytes, len(payload))
        self.assertFalse(result.infected)
        self.assertTrue(fake.sent.startswith(b"zINSTREAM\0"))
        self.assertTrue(fake.sent.endswith(struct.pack(">I", 0)))

    def test_size_limit_fails_closed(self):
        fake = FakeSocket(b"stream: OK\0")
        with patch("clamd_client.socket.socket", return_value=fake):
            client = ClamdClient(host="clamd", max_bytes=3)
            with self.assertRaisesRegex(ClamdError, "CLAMD_SCAN_SIZE_LIMIT"):
                client.scan_stream(io.BytesIO(b"1234"))


if __name__ == "__main__":
    unittest.main()
