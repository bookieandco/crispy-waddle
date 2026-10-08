import base64
import io
import json
import os
import time
from pathlib import Path
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server


def png():
    output = io.BytesIO()
    Image.new("RGB", (512, 512), (120, 82, 203)).save(output, "PNG")
    return output.getvalue()


def config(base):
    work = Path(base) / "api.json"
    work.write_text(json.dumps({
        "12": {"class_type": "CLIPTextEncode", "inputs": {"text": ""}},
        "13": {"class_type": "LoadImage", "inputs": {"image": "old"}},
        "14": {"class_type": "LoadImage", "inputs": {"image": "old"}},
        "15": {"class_type": "SaveImage", "inputs": {"filename_prefix": "old"}},
    }))
    ins, outs = Path(base) / "input", Path(base) / "output"
    ins.mkdir()
    outs.mkdir()
    return server.Config("a" * 40, "qwen-image-edit-2511-Q4_K_M", work,
                         "12", ("13", "14"), "15", "http://127.0.0.1:8188",
                         ins, outs, 15)


def request_data(cfg, refs=1):
    return {
        "schema": server.SCHEMA_REQUEST,
        "engine": "unsloth",
        "model": cfg.model,
        "prompt": "Keep pet's facial markings",
        "reference_images": [{
            "mime_type": "image/png", "image_base64": base64.b64encode(png()).decode()
        } for _ in range(refs)],
    }


class ValidatorTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.cfg = config(self.temp.name)

    def tearDown(self):
        self.temp.cleanup()

    def test_reference_image_and_model_pin(self):
        prompt, refs = server.validate_request(request_data(self.cfg, refs=3), self.cfg)
        self.assertIn("markings", prompt)
        self.assertEqual(len(refs), 3)
        self.assertTrue(refs[0].startswith(b"\x89PNG"))
        change = request_data(self.cfg)
        change["model"] = "wrong-model"
        with self.assertRaisesRegex(server.ProtocolError, "model"):
            server.validate_request(change, self.cfg)

    def test_invalid_count_and_image_content_rejected(self):
        with self.assertRaisesRegex(server.ProtocolError, "One to three"):
            server.validate_request(request_data(self.cfg, refs=4), self.cfg)
        bad = request_data(self.cfg)
        bad["reference_images"][0]["image_base64"] = "ZmFrZQ=="
        with self.assertRaises(server.ProtocolError):
            server.validate_request(bad, self.cfg)

    def test_workflow_changes_only_selected_nodes(self):
        changed = server._workflow(self.cfg, "pupson-test", ["pupson-test-0.png"], "new prompt")
        self.assertEqual(changed["12"]["inputs"]["text"], "new prompt")
        self.assertEqual(changed["13"]["inputs"]["image"], "pupson-test-0.png")
        self.assertEqual(changed["14"]["inputs"]["image"], "pupson-test-0.png")
        self.assertEqual(changed["15"]["inputs"]["filename_prefix"], "pupson-test")

    def test_late_output_sweeper_only_removes_expired_private_names(self):
        old = time.time() - 60 * 60
        old_input = self.cfg.input_dir / ("pupson-" + "a" * 32 + "-0.png")
        old_output = self.cfg.output_dir / ("pupson-" + "b" * 32 + "_00001_.png")
        other = self.cfg.output_dir / "another-customer.png"
        recent = self.cfg.input_dir / ("pupson-" + "c" * 32 + "-1.png")
        for item in (old_input, old_output, other, recent):
            item.write_bytes(png())
        for item in (old_input, old_output, other):
            os.utime(item, (old, old))
        removed = server.reap_stale_files(self.cfg, now=time.time(), ttl_seconds=1800)
        self.assertEqual(removed, 2)
        self.assertFalse(old_input.exists())
        self.assertFalse(old_output.exists())
        self.assertTrue(other.exists())
        self.assertTrue(recent.exists())

    def test_operator_selects_alternate_prompt_field(self):
        graph = json.loads(self.cfg.workflow_path.read_text())
        graph["12"]["inputs"] = {"prompt": "original"}
        self.cfg.workflow_path.write_text(json.dumps(graph))
        from dataclasses import replace
        configured = replace(self.cfg, prompt_field="prompt")
        result = server._workflow(configured, "pupson-test", ["pupson-test-0.png"], "new words")
        self.assertEqual(result["12"]["inputs"]["prompt"], "new words")

    def test_cleanup_images_after_successful_comfy_fetch(self):
        def upload(base, name, data, deadline):
            (self.cfg.input_dir / name).write_bytes(data)

        def fetch(base, path, **kwargs):
            if path == "/prompt":
                return json.dumps({"prompt_id": "job-1"}).encode()
            if path == "/history/job-1":
                files = list(self.cfg.input_dir.iterdir())
                prefix = files[0].name.rsplit("-", 1)[0]
                filename = prefix + "_00001_.png"
                (self.cfg.output_dir / filename).write_bytes(png())
                return json.dumps({"job-1": {"outputs": {"15": {"images": [
                    {"filename": filename, "subfolder": "", "type": "output"}
                ]}}}}).encode()
            if path.startswith("/view?"):
                return png()
            raise AssertionError(f"Unexpected ComfyUI route: {path}")

        with patch.object(server, "_upload", side_effect=upload), patch.object(server, "_fetch", side_effect=fetch):
            result = server.generate_with_comfy(self.cfg, "portrait", [png()])
        self.assertTrue(result.startswith(b"\x89PNG"))
        self.assertEqual(list(self.cfg.input_dir.iterdir()), [])
        self.assertEqual(list(self.cfg.output_dir.iterdir()), [])


class EndpointTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.cfg = config(self.temp.name)
        server.ImageRequestHandler.cfg = self.cfg
        self.instance = server.ThreadingHTTPServer(("127.0.0.1", 0), server.ImageRequestHandler)
        self.thread = threading.Thread(target=self.instance.serve_forever, daemon=True)
        self.thread.start()
        self.url = f"http://127.0.0.1:{self.instance.server_port}/v1/pupson/image/edit"

    def tearDown(self):
        self.instance.shutdown()
        self.instance.server_close()
        self.thread.join(timeout=3)
        self.temp.cleanup()

    def call(self, payload, token="a" * 40):
        body = json.dumps(payload).encode()
        headers = {"Content-Type": "application/json", "Authorization": "Bearer " + token}
        req = Request(self.url, body, headers, method="POST")
        try:
            with urlopen(req, timeout=3) as response:
                return response.status, json.loads(response.read())
        except HTTPError as error:
            return error.code, json.loads(error.read())

    def test_authenticated_response_is_protocol_compatible(self):
        with patch.object(server, "generate_with_comfy", return_value=png()) as fn:
            status, result = self.call(request_data(self.cfg))
        self.assertEqual(status, 200)
        self.assertEqual(result["schema"], server.SCHEMA_RESULT)
        self.assertEqual(result["engine"], "unsloth")
        self.assertEqual(result["model"], self.cfg.model)
        self.assertTrue(base64.b64decode(result["image_base64"]).startswith(b"\x89PNG"))
        self.assertEqual(fn.call_count, 1)

    def test_auth_failure_and_model_drift_fail_closed(self):
        status, _ = self.call(request_data(self.cfg), token="incorrect")
        self.assertEqual(status, 401)
        payload = request_data(self.cfg)
        payload["model"] = "other-model"
        status, _ = self.call(payload)
        self.assertEqual(status, 422)

    def test_busy_worker_rejects_concurrent_generation(self):
        server.ImageRequestHandler.lock.acquire()
        try:
            status, _ = self.call(request_data(self.cfg))
            self.assertEqual(status, 503)
        finally:
            server.ImageRequestHandler.lock.release()


if __name__ == "__main__":
    unittest.main()
