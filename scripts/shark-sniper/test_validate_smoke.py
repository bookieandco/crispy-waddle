"""Read-only structural validator does not certify provenance, latency SLA or trade."""
import json
import unittest
import quote_probe
import validate_smoke


def make_capture(count=2, fail_reverse=False):
    clock = [0.0]
    lines = ["SHARK_QUOTE_WORKER_READ_ONLY_ONESHOT_STARTED"]
    def now():
        return clock[0]
    def sleep(t):
        clock[0] += t
    def quote(src, _dst, _amt, _timeout):
        clock[0] += .25
        if fail_reverse and src == quote_probe.USDC:
            raise quote_probe.QuoteFailure("PROVIDER_RATE_LIMIT")
        return {"outAmount": 600, "elapsedMs": 250, "router": "metis", "feeBps": 1}
    quote_probe.run_probe(
        count, 2.5, 5, quote_probe.SOL, quote_probe.USDC, 100,
        quote=quote, clock=now, sleeper=sleep, emit=lines.append,
    )
    return lines


class SmokeAcceptanceTests(unittest.TestCase):
    def test_valid_source_shape_is_never_runtime_certified(self):
        packet = validate_smoke.evaluate_jsonl("\n".join(make_capture()))
        self.assertEqual(packet["structuralCheck"], "PASS")
        self.assertEqual(packet["hypotheticalCompletePairs"], 2)
        self.assertFalse(packet["runtimeAuthenticated"])
        self.assertFalse(packet["independentProviderAttested"])
        self.assertFalse(packet["deadlineCertified"])
        self.assertFalse(packet["canTrade"])

    def test_partial_reverse_failures_counted(self):
        packet = validate_smoke.evaluate_jsonl("\n".join(make_capture(fail_reverse=True)))
        self.assertEqual(packet["failedReverse"], 2)
        self.assertEqual(packet["hypotheticalCompletePairs"], 0)
        self.assertEqual(packet["failedPairs"], 2)

    def test_reject_missing_sample(self):
        rows = make_capture()
        with self.assertRaises(validate_smoke.InvalidCapture):
            validate_smoke.evaluate_jsonl("\n".join(rows[:2]+rows[3:]))

    def test_reject_fake_money_authority(self):
        rows = make_capture()
        obj = json.loads(rows[1])
        obj["canTrade"] = True
        rows[1] = json.dumps(obj)
        with self.assertRaises(validate_smoke.InvalidCapture):
            validate_smoke.evaluate_jsonl("\n".join(rows))

    def test_reject_optimistic_summary_denominator(self):
        rows = make_capture(fail_reverse=True)
        summary = json.loads(rows[-1])
        summary["successfulPairs"] = 2
        rows[-1] = json.dumps(summary)
        with self.assertRaises(validate_smoke.InvalidCapture):
            validate_smoke.evaluate_jsonl("\n".join(rows))

    def test_reject_deadline_promotion(self):
        rows = make_capture()
        summary = json.loads(rows[-1])
        summary["deadlineStatus"] = "CERTIFIED_SUBSECOND"
        rows[-1] = json.dumps(summary)
        with self.assertRaises(validate_smoke.InvalidCapture):
            validate_smoke.evaluate_jsonl("\n".join(rows))

    def test_reject_held_or_non_json(self):
        with self.assertRaises(validate_smoke.InvalidCapture):
            validate_smoke.evaluate_jsonl("SHARK_QUOTE_WORKER_HELD_NO_NETWORK_NO_TRADES")
        with self.assertRaises(validate_smoke.InvalidCapture):
            validate_smoke.evaluate_jsonl("notjson\nnotjson")

    def test_reject_naive_timestamp(self):
        rows = make_capture()
        sample = json.loads(rows[1])
        sample["observedAt"] = "2026-10-24T10:00:00"
        rows[1] = json.dumps(sample)
        with self.assertRaises(validate_smoke.InvalidCapture):
            validate_smoke.evaluate_jsonl("\n".join(rows))


if __name__ == "__main__":
    unittest.main()
