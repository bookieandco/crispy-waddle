"""Worker default-off and deliberately bounded smoke acceptance."""
import unittest
import worker_once as w


class WorkerTests(unittest.TestCase):
    def test_absent_env_is_held(self):
        seen = []
        self.assertEqual(w.main(env={}, execute=lambda _args: 999, emit=seen.append), 0)
        self.assertEqual(seen, ["SHARK_QUOTE_WORKER_HELD_NO_NETWORK_NO_TRADES"])

    def test_unknown_mode_is_held(self):
        self.assertIsNone(w.configured_args({"SHARK_QUOTE_WORKER_MODE": "live"}))

    def test_missing_or_wrong_approval_denies(self):
        for approved in ("", "true", "yes"):
            result = w.main(env={"SHARK_QUOTE_WORKER_MODE": "smoke",
                                 "SHARK_QUOTE_WORKER_READ_ONLY_APPROVED": approved},
                            execute=lambda _args: 999, emit=lambda _line: None)
            self.assertEqual(result, 2)

    def test_samples_above_four_denied(self):
        for count in ("5", "0", "999", "1.1", "-1", "abc"):
            self.assertEqual(w.main(env={
                "SHARK_QUOTE_WORKER_MODE": "smoke",
                "SHARK_QUOTE_WORKER_READ_ONLY_APPROVED": "YES",
                "SHARK_QUOTE_WORKER_SAMPLES": count,
            }, execute=lambda _args: 999, emit=lambda _line: None), 2)

    def test_explicit_smoke_is_bounded_and_no_signing(self):
        received = []
        status = w.main(env={
            "SHARK_QUOTE_WORKER_MODE": "smoke",
            "SHARK_QUOTE_WORKER_READ_ONLY_APPROVED": "YES",
            "SHARK_QUOTE_WORKER_SAMPLES": "4",
        }, execute=lambda args: received.append(args) or 0, emit=lambda _line: None)
        self.assertEqual(status, 0)
        self.assertEqual(received, [[
            "--approve-read-only", "--samples", "4",
            "--pause-seconds", "2.5", "--timeout-seconds", "5",
        ]])


if __name__ == "__main__":
    unittest.main()
