"""Hermetic tests for token authority controls and Token-2022 uncertainty."""
import copy
import importlib.util
from pathlib import Path
import unittest

HERE=Path(__file__).parent
sp=importlib.util.spec_from_file_location("rug_authority_tests",HERE/"token_authority_forensics.py")
a=importlib.util.module_from_spec(sp);sp.loader.exec_module(a)
PUB=a.native.pool_probe.encode_pubkey
MINT=PUB(bytes([9])*32)
AT="2026-10-15T12:00:00Z"
NEXT="2026-10-15T12:01:00Z"

def account(program=a.TOKEN_2022,extension=None,mint=True,freeze=False):
    info={"supply":"100000000","decimals":6,
          "mintAuthority":MINT if mint else None,
          "freezeAuthority":MINT if freeze else None}
    if extension is not None:info["extensions"]=extension
    return {"context":{"slot":123456},"value":{
        "owner":program,"data":{"parsed":{"type":"mint","info":info}}
    }}

def run(blob,at=AT,cutoff=NEXT):
    return a.audit_mint_account(MINT,blob,observed_at=at,
                                available_at=at,information_cutoff=cutoff)

class AuthorityResearchTests(unittest.TestCase):
    def test_mint_and_freeze_not_fraud_certs(self):
        r=run(account(mint=True,freeze=True,extension=[]))
        self.assertEqual(r["status"],"REVIEW_CONTROLLED_OR_UNVERIFIED")
        self.assertIn("MINT_AUTHORITY_ACTIVE",r["findings"])
        self.assertIn("FREEZE_AUTHORITY_ACTIVE",r["findings"])
        self.assertFalse(r["rugConfirmed"])
        self.assertFalse(r["canTrade"])
    def test_token_2022_unknown_visibility_fails_closed(self):
        r=run(account(mint=False))
        self.assertIn("TOKEN2022_EXTENSIONS_UNVERIFIED",r["findings"])
        self.assertFalse(r["safeTokenCertified"])
        self.assertEqual(r["extensionCoverage"],"UNKNOWN")
    def test_transfer_hook_and_fee_require_investigation(self):
        r=run(account(mint=False,extension=[{"extension":"transferHook","state":{"authority":MINT}},
             {"extension":"transferFeeConfig","state":{}}]))
        self.assertIn("TRANSFER_HOOK_RESTRICTION_POSSIBLE",r["findings"])
        self.assertIn("FEE_SCHEDULE_AMOUNTS_NOT_ATTESTED",r["findings"])
        self.assertFalse(r["transferHooksExecuted"])
        self.assertFalse(r["feeScheduleAttested"])
    def test_default_frozen_is_reported_not_confirmed_rug(self):
        r=run(account(mint=False,extension=[{"extension":"defaultAccountState","state":{"state":"Frozen"}}]))
        self.assertIn("DEFAULT_ACCOUNT_STATE_FROZEN",r["findings"])
        self.assertFalse(r["rugConfirmed"])
    def test_non_transferable_and_delegate_alerts(self):
        r=run(account(mint=False,extension=[{"extension":"nonTransferable"},
            {"extension":"permanentDelegate","state":{"delegate":MINT}}]))
        self.assertIn("NON_TRANSFERABLE_TOKEN",r["findings"])
        self.assertIn("PERMANENT_DELEGATE_AUTHORITY",r["findings"])
    def test_unknown_extension_is_not_silent_allow(self):
        r=run(account(mint=False,extension=[{"extension":"SomeNewRiskExtension","state":{}}]))
        self.assertIn("UNKNOWN_EXTENSION_REQUIRES_REVIEW",r["findings"])
    def test_empty_legacy_mint_not_safety_cert(self):
        r=run(account(program=a.LEGACY,mint=False,extension=[]))
        self.assertEqual(r["status"],"UNKNOWN_NOT_CERTIFIED")
        self.assertFalse(r["tokenTransferabilityVerified"])
    def test_legacy_token_with_2022_extension_rejected(self):
        with self.assertRaisesRegex(ValueError,"legacy_extension"):
            run(account(program=a.LEGACY,mint=False,extension=[{"extension":"transferHook"}]))
    def test_future_evidence_and_bad_program_rejected(self):
        with self.assertRaisesRegex(ValueError,"future_or_unordered"):
            run(account(),at=NEXT,cutoff=AT)
        x=account();x["value"]["owner"]="not-token-program"
        with self.assertRaisesRegex(ValueError,"mint_program_unknown"):
            run(x)
    def test_duplicate_extensions_and_bad_structures_rejected(self):
        with self.assertRaisesRegex(ValueError,"duplicate_extension"):
            run(account(extension=[{"extension":"transferHook"},{"extension":"Transfer_Hook"}]))
        with self.assertRaisesRegex(ValueError,"extension_list_invalid"):
            run(account(extension="transferHook"))
        with self.assertRaisesRegex(ValueError,"extension_shape_invalid"):
            run(account(extension=[{"extension":"fee"},42]))
    def test_invalid_address_and_missing_or_stale_slot(self):
        with self.assertRaisesRegex(ValueError,"mint_invalid"):
            a.audit_mint_account("not-base58!",account(),observed_at=AT,
                                 available_at=AT,information_cutoff=NEXT)
        x=account();x["context"]["slot"]=0
        with self.assertRaisesRegex(ValueError,"mint_account_absent"):
            run(x)
    def test_source_is_repeatable_tamper_evident_not_executing(self):
        original=account(extension=[{"extension":"transferFeeConfig"}])
        before=copy.deepcopy(original)
        first=run(original);second=run(original)
        self.assertEqual(first,second)
        self.assertEqual(original,before)
        self.assertFalse(first["canBroadcast"])
        self.assertFalse(first["canAuthorizeLive"])
        self.assertTrue(len(first["receiptDigest"])==64)

if __name__=="__main__":unittest.main()
