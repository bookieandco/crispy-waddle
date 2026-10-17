"""Hermetic TELEGRAM-LIVE.13 release policy enforcement tests.

No Telegram session, secret, network, or production authorization required.
"""
import copy
import contextlib
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import personal_release_gate as gate


def canonical():
    return json.loads(Path(gate.__file__).with_name(
        "personal_release_evidence.json").read_text(encoding="utf-8"))


class ReleaseGateTests(unittest.TestCase):
    def test_ci_passes_code_contract_but_explicitly_does_not_certify_personal_reader(self):
        ready, labels = gate.assess_release(canonical(), "ci")
        self.assertEqual(ready, 0)
        self.assertIn("TELEGRAM_LIVE13_CODE_CONTRACT_VALID", labels)
        self.assertIn("TELEGRAM_LIVE13_PRODUCTION_PERSONAL_LISTENER_HELD", labels)
        self.assertIn("TELEGRAM_LIVE13_LIVE_EVIDENCE_NOT_VERIFIED", labels)

    def test_release_mode_stays_blocked_even_when_code_only_checks_pass(self):
        code, labels = gate.assess_release(canonical(), "release")
        self.assertEqual(code, 1)
        self.assertIn("RELEASE_REQUIRES_SEPARATE_OWNER_DEVICE_CERTIFICATION", labels)

    def test_absent_live_proof_cannot_be_self_certified_by_editing_manifest(self):
        for key in gate.LIVE_KEYS:
            for forged in ("VERIFIED", "PASS", True, None):
                manifest = canonical()
                manifest["live_checks"][key] = forged
                with self.subTest(key=key, forged=forged):
                    with self.assertRaisesRegex(
                        gate.ReleaseEvidenceInvalid,
                        "RELEASE_LIVE_EVIDENCE_MUST_REMAIN_UNVERIFIED",
                    ):
                        gate.evaluate_code_only_gate(manifest)

    def test_no_capability_escalation_in_ci_contract(self):
        for key in gate.DENIED_PERMISSIONS:
            manifest = canonical()
            manifest["permissions"][key] = True
            with self.subTest(permission=key), self.assertRaisesRegex(
                gate.ReleaseEvidenceInvalid, "RELEASE_UNAUTHORIZED_CAPABILITY_PRESENT"
            ):
                gate.evaluate_code_only_gate(manifest)
        manifest = canonical()
        manifest["permissions"]["ai_training"] = 0
        with self.assertRaises(gate.ReleaseEvidenceInvalid):
            gate.evaluate_code_only_gate(manifest)

    def test_missing_checks_or_forged_offline_status_fail(self):
        for key in gate.CODE_KEYS:
            manifest = canonical()
            del manifest["code_checks"][key]
            with self.subTest(key=key), self.assertRaises(gate.ReleaseEvidenceInvalid):
                gate.evaluate_code_only_gate(manifest)
        manifest = canonical()
        manifest["code_checks"]["credentials_denied_in_ci"] = "SKIPPED"
        with self.assertRaises(gate.ReleaseEvidenceInvalid):
            gate.evaluate_code_only_gate(manifest)

    def test_schema_extra_metadata_or_mismatched_parent_issue_fail_closed(self):
        examples = []
        bad = canonical()
        bad["sensitive_login_code"] = "private OTP must not be stored"
        examples.append(bad)
        bad = canonical()
        bad["audit_issue"] = 1239
        examples.append(bad)
        bad = canonical()
        bad["stage"] = "LIVE"
        examples.append(bad)
        bad = canonical()
        bad["pull_request"] = True
        examples.append(bad)
        for manifest in examples:
            with self.assertRaises(gate.ReleaseEvidenceInvalid):
                gate.evaluate_code_only_gate(manifest)

    def test_public_output_does_not_echo_manifest_or_ids(self):
        redacted = "TELEGRAM_SENSITIVE_TEST_VALUE"
        manifest = canonical()
        manifest["unexpected"] = redacted
        with patch.object(gate, "read_release_manifest", return_value=manifest):
            with contextlib.redirect_stdout(io.StringIO()) as output:
                self.assertEqual(gate.main(["--mode", "ci"]), 2)
        public = output.getvalue()
        self.assertNotIn(redacted, public)
        self.assertIn("TELEGRAM_LIVE13_RELEASE_GATE_INVALID", public)
        with contextlib.redirect_stdout(io.StringIO()) as output:
            self.assertEqual(gate.main(["--mode", "release"]), 1)
        self.assertNotIn("PERSONAL_LISTENER_READY", output.getvalue())
        self.assertIn("PRODUCTION_PERSONAL_LISTENER_HELD", output.getvalue())

    def test_manifest_size_symlink_and_missing_file_guards(self):
        with tempfile.TemporaryDirectory() as scratch:
            folder = Path(scratch)
            file = folder / "evidence.json"
            with self.assertRaisesRegex(
                gate.ReleaseEvidenceInvalid, "MISSING_OR_LINKED"
            ):
                gate.read_release_manifest(file)
            file.write_bytes(b"x" * (gate.MAX_MANIFEST_SIZE + 1))
            with self.assertRaisesRegex(
                gate.ReleaseEvidenceInvalid, "OVERSIZED"
            ):
                gate.read_release_manifest(file)
            file.write_text('{"ok": false}', encoding="utf-8")
            self.assertEqual(gate.read_release_manifest(file), {"ok": False})
            symlink = folder / "linked.json"
            symlink.symlink_to(file)
            with self.assertRaisesRegex(
                gate.ReleaseEvidenceInvalid, "MISSING_OR_LINKED"
            ):
                gate.read_release_manifest(symlink)

    def test_invalid_mode_rejected_in_api_no_unauthorized_success(self):
        with self.assertRaisesRegex(gate.ReleaseEvidenceInvalid, "INVALID_RELEASE_MODE"):
            gate.assess_release(canonical(), "approve")

if __name__ == "__main__":
    unittest.main()
