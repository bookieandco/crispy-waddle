"""Hermetic Jupiter V2 quote-only host contract, rate pacing and failure coverage."""
import io
import json
import unittest
import urllib.error
from contextlib import redirect_stderr
from unittest.mock import patch
import quote_probe as p


class Response:
    status = 200
    def __init__(self, data): self.data = json.dumps(data).encode()
    def __enter__(self): return self
    def __exit__(self, *_): return False
    def read(self, size): return self.data[:size]


def valid(**changes):
    data = {
        "inputMint": p.SOL,
        "outputMint": p.USDC,
        "inAmount": "100",
        "outAmount": "250",
        "requestId": "fake-test-id-only",
        "router": "metis",
        "mode": "ultra",
        "feeBps": 10,
        "routePlan": [{"swapInfo": {}}],
        "transaction": None,
        "taker": None,
    }
    data.update(changes)
    return data


class QuoteV2Tests(unittest.TestCase):
    def test_no_network_by_default(self):
        with redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
            p.main([])

    def test_fixed_get_no_taker_no_slippage_no_execute(self):
        captured = []
        def fake(req, timeout):
            captured.append(req)
            self.assertEqual(req.get_method(), "GET")
            self.assertTrue(req.full_url.startswith("https://api.jup.ag/swap/v2/order?"))
            self.assertNotIn("taker=", req.full_url)
            self.assertNotIn("slippageBps=", req.full_url)
            self.assertNotIn("execute", req.full_url)
            self.assertEqual(req.headers["Accept"], "application/json")
            return Response(valid())
        result = p.read_quote(p.SOL, p.USDC, 100, opener=fake,
                              clock=iter((0, .08)).__next__)
        self.assertEqual(result["elapsedMs"], 80)
        self.assertEqual(result["outAmount"], 250)
        self.assertEqual(result["router"], "metis")
        self.assertFalse(result["contextSlotAvailable"])
        self.assertEqual(len(captured), 1)

    def test_rfq_without_v1_context_slot_or_route_plan(self):
        result = p.parse_v2_quote(valid(router="jupiterz", routePlan=None), p.SOL, p.USDC, 100)
        self.assertEqual(result["outAmount"], 250)
        self.assertIsNone(result["providerContextSlot"])
        self.assertFalse(result["routePlanPresent"])

    def test_reject_transaction_taker_wrong_mint_and_amount(self):
        for changed in (
            {"transaction": "base64-not-allowed"},
            {"transaction": ""},
            {"transaction": "MISSING"},
            {"taker": p.SOL},
            {"outputMint": p.SOL},
            {"inAmount": "101"},
            {"outAmount": "0"},
            {"outAmount": "Infinity"},
            {"requestId": ""},
            {"errorCode": 123},
            {"error": "bad"},
        ):
            with self.subTest(changed=changed), self.assertRaises(p.QuoteFailure):
                p.parse_v2_quote(valid(**changed), p.SOL, p.USDC, 100)

    def test_reject_untrusted_router_mode_fee_and_route(self):
        for changed in (
            {"router": "unknown"}, {"router": []}, {"mode": []},
            {"mode": "unsafe"}, {"feeBps": float("nan")},
            {"feeBps": 10001}, {"routePlan": "not-list"},
        ):
            with self.subTest(changed=changed), self.assertRaises(p.QuoteFailure):
                p.parse_v2_quote(valid(**changed), p.SOL, p.USDC, 100)

    def test_http_rate_limit_and_auth_required(self):
        for code, expected in ((429, "PROVIDER_RATE_LIMIT"), (401, "PROVIDER_AUTH_REQUIRED"),
                               (403, "PROVIDER_AUTH_REQUIRED"), (500, "PROVIDER_HTTP_ERROR")):
            def fail(_request, timeout):
                raise urllib.error.HTTPError(p.BASE, code, "redacted", {}, None)
            with self.subTest(code=code), self.assertRaisesRegex(p.QuoteFailure, expected):
                p.read_quote(p.SOL, p.USDC, 100, opener=fail)

    def test_pacing_does_not_fake_trading(self):
        clock = [0.0]
        records = []
        def now(): return clock[0]
        def sleep(t): clock[0] += t
        def quote(_a, _b, _amt, _timeout):
            clock[0] += .08
            return {"outAmount": 200, "elapsedMs": 80, "router": "metis", "feeBps": 1}
        out = p.run_probe(2, 2.5, 5, p.SOL, p.USDC, 100,
                          quote=quote, clock=now, sleeper=sleep,
                          emit=lambda line: records.append(json.loads(line)))
        self.assertEqual(out["successfulPairs"], 2)
        self.assertEqual(out["forwardHttpMs"]["p99"], 80)
        self.assertGreaterEqual(records[0]["pairWallMs"], 2500)
        self.assertFalse(out["canTrade"])
        self.assertFalse(out["canBroadcast"])
        self.assertEqual(out["observedTrades"], 0)

    def test_reverse_failure_keeps_both_attempt_durations(self):
        clock = [0.0]
        records = []
        def now(): return clock[0]
        def sleep(t): clock[0] += t
        def quote(src, _dest, _amt, _timeout):
            clock[0] += 0.14 if src == p.SOL else .42
            if src == p.USDC:
                raise p.QuoteFailure("PROVIDER_UNREACHABLE")
            return {"outAmount": 250, "elapsedMs": 140, "router": "metis", "feeBps": 10}
        summary = p.run_probe(1, 2.5, 5, p.SOL, p.USDC, 100,
                              quote=quote, clock=now, sleeper=sleep,
                              emit=lambda line: records.append(json.loads(line)))
        self.assertEqual(summary["successfulPairs"], 0)
        self.assertEqual(summary["requestAttempts"], {"forward": 1, "reverse": 1})
        self.assertEqual(summary["forwardAttemptMsIncludingErrors"]["p99"], 140)
        self.assertEqual(summary["reverseAttemptMsIncludingErrors"]["p99"], 420)
        self.assertEqual(summary["failuresByStage"]["reverse"], 1)
        self.assertEqual(records[0]["status"], "NO_QUOTE")

    def test_invalid_rate_policy_and_mint(self):
        for pause, timeout in ((float("nan"), 5), (2.5, float("inf")), (2.4, 5)):
            with self.assertRaises(ValueError):
                p.run_probe(1, pause, timeout, p.SOL, p.USDC, 100, emit=lambda _: None)
        with self.assertRaises(ValueError):
            p.validate_mint("https://malicious.example/")
        with self.assertRaises(ValueError):
            p.read_quote(p.SOL, p.USDC, 0)

    def test_forward_unusable_output_skips_reverse(self):
        called = []
        def quote(src, _dst, _amt, _timeout):
            called.append(src)
            return {"outAmount": 10**20, "elapsedMs": 1, "router": "metis", "feeBps": 1}
        summary = p.run_probe(1, 2.5, 5, p.SOL, p.USDC, 100,
                              quote=quote, emit=lambda _: None)
        self.assertEqual(called, [p.SOL])
        self.assertEqual(summary["failuresByStage"]["forward"], 1)
        self.assertEqual(summary["requestAttempts"]["reverse"], 0)

    def test_api_key_optional_and_never_in_url(self):
        key = "example-key-from-test"
        def fake(req, timeout):
            self.assertEqual(req.headers["X-api-key"], key)
            self.assertNotIn(key, req.full_url)
            return Response(valid())
        p.read_quote(p.SOL, p.USDC, 100, opener=fake, api_key=key)
        with self.assertRaises(ValueError):
            p.read_quote(p.SOL, p.USDC, 100, opener=fake, api_key="bad\nkey")


if __name__ == "__main__":
    unittest.main()
