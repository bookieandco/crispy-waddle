"""Hermetic witness validator tests; real quotes/forward cycles NOT generated."""
import json
import unittest
from unittest.mock import Mock

import shark_fresh_forward_witness as witness


class Response:
    def __init__(self, value, status=200):
        self.status = status
        self.data = json.dumps(value).encode()
    def __enter__(self):
        return self
    def __exit__(self, *args):
        return False
    def read(self, maximum):
        return self.data[:maximum]


class WitnessTests(unittest.TestCase):
    def setUp(self):
        self.payload = {
            "status": "ready",
            "authority": "SHADOW_LEARNING_ONLY",
            "canExecute": False, "canSign": False,
            "canBroadcast": False, "canAuthorizeLive": False,
            "certification": {
                "observationCounts": {"15M": 2, "1H": 1},
                "lessonCounts": {"15M": 2, "1H": 1},
            },
        }

    def run_health(self, payload=None, status=200):
        return witness.read_loopback(
            8094, fetch=lambda url, timeout: self._fetch(
                url, timeout, self.payload if payload is None else payload, status))

    def _fetch(self, url, timeout, payload, status):
        self.assertEqual(url, "http://127.0.0.1:8094/health")
        self.assertEqual(timeout, 10)
        return Response(payload, status)

    def test_read_only_loopback_witness_does_not_certify_market_provider(self):
        receipt = self.run_health()
        self.assertEqual(receipt["schema"], "shark.fresh.forward-paper-witness.v1")
        self.assertTrue(receipt["liveServiceHttp200Observed"])
        self.assertFalse(receipt["providerProvenanceIndependentlyVerified"])
        self.assertFalse(receipt["genuineSevenDayOutcomeWindowCertified"])
        self.assertFalse(receipt["canExecute"])
        self.assertEqual(receipt["certification"]["observationCounts"]["15M"], 2)
        self.assertEqual(receipt["certification"]["observationCounts"]["7D"], 0)

    def test_unauthorized_or_nonready_health_never_admitted(self):
        for bad in [
            {**self.payload, "canSign": True},
            {**self.payload, "authority": "LIVE_TRADING"},
            {**self.payload, "status": "blocked"},
        ]:
            with self.subTest(bad=bad):
                with self.assertRaises(witness.WitnessError):
                    self.run_health(bad)

    def test_503_health_and_unsafe_port_blocked(self):
        with self.assertRaisesRegex(witness.WitnessError, "NOT_HEALTHY"):
            self.run_health(status=503)
        with self.assertRaisesRegex(witness.WitnessError, "UNSAFE_LOOPBACK_PORT"):
            witness.read_loopback(80, fetch=Mock())

    def test_malformed_horizon_or_negative_count_fails(self):
        for counts in [
            {"15M": -1},
            {"15M": "one"},
            [1, 2],
        ]:
            bad = {**self.payload, "certification": {
                **self.payload["certification"], "observationCounts": counts}}
            with self.subTest(counts=counts):
                with self.assertRaises(witness.WitnessError):
                    self.run_health(bad)


if __name__ == "__main__":
    unittest.main()
