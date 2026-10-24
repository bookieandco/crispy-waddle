"""Hermetic proof of disabled-by-default and provenance-safe quote timing."""
import io
import json
import unittest
from contextlib import redirect_stderr
import quote_probe as p


class Response:
    status = 200
    def __init__(self, data): self.data = json.dumps(data).encode()
    def __enter__(self): return self
    def __exit__(self, *_): return False
    def read(self, size): return self.data[:size]


class Tests(unittest.TestCase):
    def test_default_requires_opt_in(self):
        with redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
            p.main([])

    def test_valid_quote_and_exact_amount(self):
        expected = {"inputMint": p.SOL, "outputMint": p.USDC, "inAmount": "100",
                    "outAmount": "250", "routePlan": [{"swapInfo": {}}], "contextSlot": 300}
        result = p.read_quote(p.SOL, p.USDC, 100, opener=lambda *_args, **_kwargs: Response(expected),
                              clock=iter([0, .12]).__next__)
        self.assertEqual(result["elapsedMs"], 120)
        self.assertEqual(result["outAmount"], 250)

    def test_reject_wrong_pair_empty_route_and_oversize(self):
        for changed in ({"outputMint": p.SOL}, {"routePlan": []}, {"contextSlot": None}):
            obj = {"inputMint": p.SOL, "outputMint": p.USDC, "inAmount": "100",
                   "outAmount": "200", "routePlan": [{"swapInfo": {}}], "contextSlot": 123}
            obj.update(changed)
            with self.assertRaises(p.QuoteFailure):
                p.read_quote(p.SOL, p.USDC, 100, opener=lambda *_a, **_k: Response(obj))

    def test_pacing_percentiles_and_no_trade_authority(self):
        clock = [0]
        def now(): return clock[0]
        def sleep(t): clock[0] += t
        records = []
        def quote(mint_in, mint_out, amount, timeout_s):
            clock[0] += .08
            return {"elapsedMs": 80, "outAmount": 200, "contextSlot": 150}
        out = p.run_probe(2, 2.5, 5, p.SOL, p.USDC, 100, quote=quote,
                          clock=now, sleeper=sleep, emit=lambda x: records.append(json.loads(x)))
        self.assertEqual(out["successfulPairs"], 2)
        self.assertEqual(out["forwardHttpMs"]["p99"], 80)
        self.assertFalse(out["canTrade"])
        self.assertEqual(out["deadlineStatus"], "INSUFFICIENT_PROSPECTIVE_HOST_DATA")
        self.assertGreaterEqual(records[0]["pairWallMs"], 2500)

    def test_error_not_success_and_address_validation(self):
        with self.assertRaises(ValueError): p.validate_mint("https://evil.example/")
        def fail(*_args): raise p.QuoteFailure("PROVIDER_RATE_LIMIT")
        data = p.run_probe(1, 2.5, 5, p.SOL, p.USDC, 100, quote=fail, emit=lambda _: None)
        self.assertEqual(data["successfulPairs"], 0)
        self.assertEqual(data["failures"], {"PROVIDER_RATE_LIMIT": 1})


if __name__ == "__main__": unittest.main()
