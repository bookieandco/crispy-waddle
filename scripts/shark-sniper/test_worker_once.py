"""Default-held Railway worker with explicit scope + cost authorization."""
import unittest
import worker_once as w

PROJECT = "22222222-2222-4222-8222-222222222222"
ENVIRONMENT = "33333333-3333-4333-8333-333333333333"
SERVICE = "44444444-4444-4444-8444-444444444444"


def scope(**changes):
    data = {
        "SHARK_QUOTE_WORKER_MODE": "smoke",
        "SHARK_QUOTE_WORKER_READ_ONLY_APPROVED": "YES",
        "SHARK_QUOTE_WORKER_METERED_BUDGET_APPROVED": "YES",
        "SHARK_QUOTE_WORKER_SAMPLES": "4",
        "RAILWAY_PROJECT_ID": PROJECT,
        "RAILWAY_ENVIRONMENT_ID": ENVIRONMENT,
        "RAILWAY_SERVICE_ID": SERVICE,
        "SHARK_QUOTE_EXPECTED_PROJECT_ID": PROJECT,
        "SHARK_QUOTE_EXPECTED_ENVIRONMENT_ID": ENVIRONMENT,
        "SHARK_QUOTE_EXPECTED_SERVICE_ID": SERVICE,
        "RAILWAY_SERVICE_NAME": "shark-quote-research-only",
    }
    data.update(changes)
    return data


class WorkerTests(unittest.TestCase):
    def test_absent_env_is_held(self):
        seen = []
        self.assertEqual(w.main(env={}, execute=lambda _args: 999, emit=seen.append), 0)
        self.assertEqual(seen, ["SHARK_QUOTE_WORKER_HELD_NO_NETWORK_NO_TRADES"])

    def test_unknown_mode_is_held(self):
        self.assertIsNone(w.configured_args({"SHARK_QUOTE_WORKER_MODE": "live"}))

    def test_missing_approvals_fail_closed(self):
        for changes in ({"SHARK_QUOTE_WORKER_READ_ONLY_APPROVED": ""},
                        {"SHARK_QUOTE_WORKER_METERED_BUDGET_APPROVED": ""},
                        {"SHARK_QUOTE_WORKER_METERED_BUDGET_APPROVED": "true"}):
            self.assertEqual(w.main(env=scope(**changes),
                                    execute=lambda _args: 999,
                                    emit=lambda _line: None), 2)

    def test_host_ids_and_name_must_match_exactly(self):
        for changes in ({"RAILWAY_PROJECT_ID": SERVICE},
                        {"RAILWAY_ENVIRONMENT_ID": SERVICE},
                        {"RAILWAY_SERVICE_ID": ENVIRONMENT},
                        {"SHARK_QUOTE_EXPECTED_SERVICE_ID": ""},
                        {"RAILWAY_SERVICE_ID": "not-a-uuid"},
                        {"RAILWAY_SERVICE_NAME": "jhadina-telegram-owner-listener"}):
            self.assertEqual(w.main(env=scope(**changes),
                                    execute=lambda _args: 999,
                                    emit=lambda _line: None), 2)

    def test_ci_vercel_and_provider_key_denied(self):
        for changes in ({"CI": "true"}, {"GITHUB_ACTIONS": "true"},
                        {"VERCEL": "1"}, {"JUPITER_API_KEY": "secret-placeholder"}):
            self.assertEqual(w.main(env=scope(**changes),
                                    execute=lambda _args: 999,
                                    emit=lambda _line: None), 2)

    def test_samples_above_four_denied(self):
        for count in ("5", "0", "999", "1.1", "-1", "abc", "١"):
            self.assertEqual(w.main(env=scope(SHARK_QUOTE_WORKER_SAMPLES=count),
                                    execute=lambda _args: 999,
                                    emit=lambda _line: None), 2)

    def test_explicit_bounded_smoke(self):
        args = []
        status = w.main(env=scope(), execute=lambda a: args.append(a) or 0,
                        emit=lambda _line: None)
        self.assertEqual(status, 0)
        self.assertEqual(args, [[
            "--approve-read-only", "--samples", "4",
            "--pause-seconds", "2.5", "--timeout-seconds", "5",
        ]])


if __name__ == "__main__":
    unittest.main()
