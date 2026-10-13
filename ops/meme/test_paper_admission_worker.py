import copy
import importlib.util
import pathlib
import unittest

HERE=pathlib.Path(__file__).parent
sp=importlib.util.spec_from_file_location("paper_admission_worker",HERE/"paper_admission_worker.py")
p=importlib.util.module_from_spec(sp)
sp.loader.exec_module(p)
obs=p.obs

MINT="So11111111111111111111111111111111111111112"
T0="2026-10-14T01:00:00Z"
T1="2026-10-14T01:00:10Z"
T2="2026-10-14T01:00:12Z"


def decision():
    s=obs.empty_state()
    obs.append_event(s,{"type":"MARKET_OBSERVATION","mint":MINT,"pair":"abc",
                         "observedAt":T0,"availableAt":T0,
                         "securityStatus":"UNVERIFIED","canTrade":False})
    d=s["events"][-1]["digest"]
    obs.append_event(s,{"type":"SHADOW_NO_TRADE_DECISION",
                         "decisionId":"d:"+d,"mint":MINT,
                         "marketEvidenceDigest":d,
                         "action":"NO_TRADE",
                         "observedAt":T1,"availableAt":T1,
                         "canTrade":False,"canSign":False,"canBroadcast":False})
    return s


class PaperAdmission(unittest.TestCase):
    def test_absent_all_safety_checks_always_abstains(self):
        s=decision()
        x=p.reconcile(s,T2)
        self.assertEqual(x["newFailClosedAssessments"],1)
        self.assertEqual(x["paperOrders"],0)
        receipt=s["events"][-1]
        self.assertEqual(receipt["disposition"],"NO_TRADE")
        self.assertEqual(receipt["paperNotionalUsd"],0)
        self.assertIn("MONEY_CORE_PAPER_APPROVAL_MISSING",receipt["reasons"])
        self.assertIn("CRITICAL_COVERAGE_MISSING:",str(receipt["reasons"]))
        self.assertEqual(p.reconcile(s,T2)["newFailClosedAssessments"],0)
        obs.audit(s)

    def test_onchain_freeze_evidence_blocks_not_rug_convicts(self):
        s=decision()
        obs.append_event(s,{"type":"SOLANA_MINT_PROBE","mint":MINT,
                            "status":"ONCHAIN_PARTIAL_UNVERIFIED",
                            "observedAt":T0,"availableAt":T0,
                            "signals":["FREEZE_AUTHORITY_ACTIVE"]})
        x=p.assess_abstention(s,s["events"][1],T2)
        self.assertEqual(x["rugDefenseDisposition"],"BLOCK")
        self.assertFalse(x["canTrade"])
        self.assertEqual(x["moneyApproval"],"ABSENT")

    def test_future_probe_never_influences_past_decision(self):
        s=decision()
        obs.append_event(s,{"type":"SOLANA_MINT_PROBE","mint":MINT,
                            "status":"ONCHAIN_PARTIAL_UNVERIFIED",
                            "observedAt":T2,"availableAt":T2,
                            "signals":["FREEZE_AUTHORITY_ACTIVE"]})
        x=p.assess_abstention(s,s["events"][1],T2)
        self.assertIsNone(x["mintProbeEvidenceDigest"])
        self.assertEqual(x["rugDefenseDisposition"],"REVIEW")

    def test_rejects_forged_paper_or_future_decision(self):
        s=decision()
        fake=copy.deepcopy(s["events"][1])
        fake["action"]="PAPER_TRADE"
        with self.assertRaisesRegex(ValueError,"no_trade_only"):
            p.assess_abstention(s,fake,T2)
        with self.assertRaisesRegex(ValueError,"paper_evidence_from_future"):
            p.assess_abstention(s,s["events"][1],T0)


if __name__=="__main__":
    unittest.main()
