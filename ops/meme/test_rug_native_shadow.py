"""Hermetic SHARK-RUG-DATA.07–.10 fail-closed research regressions."""
import base64
import copy
import importlib.util
from pathlib import Path
import unittest

HERE=Path(__file__).resolve().parent
def load(name):
    s=importlib.util.spec_from_file_location("native_test_"+name,HERE/(name+".py"))
    m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m

n=load("rug_native_shadow")
mint=n.mint_probe
pool=n.pool_probe
TIME="2026-10-15T01:10:00Z"
SEAL="2026-10-15T01:00:00Z"
DISCOVERY="2026-10-15T00:00:00Z"
DECISION="2026-10-15T01:12:00Z"
END="2026-10-16T03:00:00Z"
ASOF="2026-10-16T04:00:00Z"
TOKEN="TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"

def pub(byte):
    return pool.encode_pubkey(bytes([byte])*32)

def account(mint_addr,freeze=False,token_program=TOKEN):
    return {"context":{"slot":100},"value":{"owner":token_program,
        "data":{"parsed":{"type":"mint","info":{"supply":"1000000","decimals":6,
             "mintAuthority":None,"freezeAuthority":mint_addr if freeze else None}}}}}

def receipts(i=20,freeze=False,at=TIME,venue="pumpswap"):
    address=pub(i)
    quote=pub(7)
    p=pub(8)
    a,b=pub(9),pub(10)
    program,length,offsets=pool.PROGRAMS[venue]
    raw=bytearray(length)
    for pos,item in zip(offsets,(address,quote,a,b)):
        raw[pos:pos+32]=bytes([{"addr":i}.get("addr")])*32 if item==address else (
            bytes([7])*32 if item==quote else bytes([9])*32 if item==a else bytes([10])*32
        )
    pair={"dex":venue,"mint":address,"quoteMint":quote,"pair":p,"digest":"synthetic:market"}
    context={"context":{"slot":100},"value":{"owner":program,
             "data":[base64.b64encode(raw).decode(),"base64"]}}
    def vault_record(vault_mint,amount):
        return {"context":{"slot":101},"value":{"owner":TOKEN,
           "data":{"parsed":{"type":"account","info":{
               "mint":vault_mint,"owner":pub(17),
               "tokenAmount":{"amount":str(amount),"decimals":6}}}}}}
    mint_receipt=mint.verify_mint(address,account(address,freeze),None,at)
    pool_receipt=pool.attest_pool(pair,context,vault_record(address,100000),
                                  vault_record(quote,500000),at)
    return mint_receipt,pool_receipt

def cohort(count=20):
    return {"schema":n.SCHEMA,"cohortId":"synthetic-cohort-001","sealedAt":SEAL,
        "sourceHeadDigest":"a"*64,"samplingPolicy":"PROSPECTIVE_ALL_ELIGIBLE",
        "minimumControlHorizonSeconds":86400,
        "cases":[{"caseId":f"case-{i:02}","mint":pub(30+i),"actorGroup":f"actor-{i:02}",
                  "discoveryEvidenceId":f"synthetic-discovery-{i:02}",
                  "discoveryAvailableAt":DISCOVERY,"venueStratum":"PUMPSWAP"}
                 for i in range(count)],
        "authority":"RESEARCH_ONLY","canTrade":False,"canSign":False,
        "canBroadcast":False,"externalSealWitnessed":False}

def prepared(count=20,abstain_at=None,mutate=None):
    seal=n.seal_control_cohort(cohort(count))
    decisions=[]
    for i,case in enumerate(seal["cases"]):
        if i==abstain_at:
            mp,pp=None,None
        else:
            flagged=(i<10 and i%5!=0) or (i>=10 and i%5==0)
            mp,pp=receipts(30+i,freeze=flagged)
        item={"caseId":case["caseId"],"decisionAt":DECISION,
             "mintProof":mp,"poolProof":pp}
        if mutate:mutate(i,item)
        decisions.append(item)
    frozen=n.freeze_shadow_decisions(seal,decisions)
    return seal,frozen

def outcomes(count=20):
    rows=[]
    for i in range(count):
        pos=i<10
        rows.append({
            "caseId":f"case-{i:02}",
            "outcomeKind":"REPORTED_LP_WITHDRAWAL" if pos else "MONITORED_NO_REPORTED_RUG",
            "observedAt":END,"availableAt":END,
            "sourceFamilies":[f"forensic-report-{i%2}",f"independent-archive-{i%3}"],
            "outcomeEvidenceIds":[f"synthetic:receipt-a:{i}",f"synthetic:receipt-b:{i}"],
            "monitoringComplete":not pos,"windowStartAt":None if pos else DECISION,
            "windowEndAt":None if pos else END
        })
    return rows

class NativeEvidenceTests(unittest.TestCase):
    def test_canonical_pump_and_raydium_receipts_preserve_unverified(self):
        for venue in ("pumpswap","raydium"):
            mp,pp=receipts(20,venue=venue)
            result=n.assess_solana_evidence(mint=pub(20), information_cutoff=DECISION,
                                            mint_proof=mp,pool_proof=pp)
            self.assertEqual(result["status"],"RESEARCH_WATCH")
            self.assertTrue(result["coverage"]["poolVaultMapping"])
            self.assertFalse(result["coverage"]["lpControl"])
            self.assertFalse(result["sellabilityCertified"])
            self.assertFalse(result["rugConfirmed"])
            self.assertFalse(result["canTrade"])
            self.assertIn("NOT_SAFETY_CERTIFICATION",result["reasons"][0])
    def test_native_authorities_are_warning_not_rug_verdict(self):
        mp,pp=receipts(20,freeze=True)
        r=n.assess_solana_evidence(mint=pub(20),information_cutoff=DECISION,
                                  mint_proof=mp,pool_proof=pp)
        self.assertEqual(r["status"],"REVIEW_HIGH_RISK")
        self.assertIn("FREEZE_AUTHORITY_ACTIVE",r["reasons"])
        self.assertFalse(r["rugConfirmed"])
    def test_missing_proofs_abstain_not_safe(self):
        r=n.assess_solana_evidence(mint=pub(20),information_cutoff=DECISION)
        self.assertEqual(r["status"],"ABSTAIN")
        self.assertFalse(r["coverage"]["sellability"])
    def test_mismatched_mint_and_vault_rejected(self):
        mp,pp=receipts(20)
        pp["baseVault"]["mint"]=pub(40)
        with self.assertRaisesRegex(ValueError,"pool_vault_identity_mismatch"):
            n.assess_solana_evidence(mint=pub(20),information_cutoff=DECISION,
                                     mint_proof=mp,pool_proof=pp)
    def test_future_source_and_stale_pool_rejected(self):
        mp,pp=receipts(20,at=END)
        with self.assertRaisesRegex(ValueError,"lookahead"):
            n.assess_solana_evidence(mint=pub(20),information_cutoff=DECISION,
                                     mint_proof=mp,pool_proof=pp)
        mp,pp=receipts(20)
        pp["poolSlot"]=99
        with self.assertRaisesRegex(ValueError,"stale_pool_slot"):
            n.assess_solana_evidence(mint=pub(20),information_cutoff=DECISION,
                                     mint_proof=mp,pool_proof=pp)
    def test_false_safety_or_executable_authority_rejected(self):
        mp,pp=receipts(20)
        pp["coverage"]["sellability"]=True
        with self.assertRaisesRegex(ValueError,"overstated_coverage"):
            n.assess_solana_evidence(mint=pub(20),information_cutoff=DECISION,
                                     mint_proof=mp,pool_proof=pp)
        mp,pp=receipts(20)
        pp["canBroadcast"]=True
        with self.assertRaisesRegex(ValueError,"execution_authority"):
            n.assess_solana_evidence(mint=pub(20),information_cutoff=DECISION,
                                     mint_proof=mp,pool_proof=pp)
    def test_invalid_base58_and_too_short_sol_address_rejected(self):
        for addr in ("11111111111111111111111111111111O","abc"*11,"1"*33):
            with self.assertRaisesRegex(ValueError,"mint_invalid"):
                n.assess_solana_evidence(mint=addr,information_cutoff=DECISION)

class ProspectiveCohortTests(unittest.TestCase):
    def test_seal_is_source_only_and_full_case_prespecified(self):
        seal=n.seal_control_cohort(cohort())
        self.assertEqual(seal["status"],"SOURCE_ONLY_SEAL_UNWITNESSED")
        self.assertFalse(seal["externalSealWitnessed"])
        self.assertFalse(seal["canTrade"])
        self.assertEqual(len(seal["cases"]),20)
    def test_duplicate_actor_and_training_actor_leakage_rejected(self):
        plan=cohort()
        plan["cases"][1]["actorGroup"]=plan["cases"][0]["actorGroup"]
        with self.assertRaisesRegex(ValueError,"duplicate_or_leaked"):
            n.seal_control_cohort(plan)
        with self.assertRaisesRegex(ValueError,"duplicate_or_leaked"):
            n.seal_control_cohort(cohort(),training_actor_groups=("actor-05",))
    def test_future_discovery_and_short_controls_rejected(self):
        plan=cohort()
        plan["cases"][0]["discoveryAvailableAt"]=END
        with self.assertRaisesRegex(ValueError,"future_discovery"):
            n.seal_control_cohort(plan)
        plan=cohort();plan["minimumControlHorizonSeconds"]=60
        with self.assertRaisesRegex(ValueError,"horizon_too_short"):
            n.seal_control_cohort(plan)
    def test_future_or_preseal_features_rejected(self):
        s=n.seal_control_cohort(cohort(1))
        mp,pp=receipts(30,at=DISCOVERY)
        with self.assertRaisesRegex(ValueError,"preseal_features"):
            n.freeze_shadow_decisions(s,[{"caseId":"case-00","decisionAt":DECISION,
                                          "mintProof":mp,"poolProof":pp}])
        mp,pp=receipts(30,at=END)
        with self.assertRaisesRegex(ValueError,"lookahead"):
            n.freeze_shadow_decisions(s,[{"caseId":"case-00","decisionAt":DECISION,
                                          "mintProof":mp,"poolProof":pp}])
    def test_all_cases_required_no_posthoc_omission(self):
        s=n.seal_control_cohort(cohort(2))
        with self.assertRaisesRegex(ValueError,"prespecified_cohort"):
            n.freeze_shadow_decisions(s,[{"caseId":"case-00","decisionAt":DECISION,
                                          "mintProof":None,"poolProof":None}])

class ShadowReplayTests(unittest.TestCase):
    def test_descriptive_synthetic_score_not_certified(self):
        s,f=prepared()
        result=n.grade_shadow_replay(s,f,outcomes(),ASOF)
        self.assertEqual(result["verdict"],"DESCRIPTIVE_REPORTED_OUTCOMES_ONLY")
        self.assertEqual(result["prespecifiedCases"],20)
        self.assertEqual(result["shadowScore"]["balancedAccuracy"],.8)
        self.assertEqual(result["shadowScore"]["truePositiveRate"],.8)
        self.assertEqual(result["shadowScore"]["falsePositiveRate"],.2)
        self.assertEqual(result["calibration"],"UNVERIFIED")
        self.assertIsNone(result["rugConfirmedCount"])
        self.assertFalse(result["canPromoteModel"])
        self.assertFalse(result["canTrade"])
        self.assertEqual(result["actualFills"],0)
        self.assertIsNone(result["realizedPnl"])
        self.assertEqual(result,n.grade_shadow_replay(s,f,outcomes(),ASOF))
    def test_censored_cases_not_silently_excluded(self):
        s,f=prepared()
        r=n.grade_shadow_replay(s,f,outcomes()[:19],ASOF)
        self.assertEqual(r["verdict"],"UNSCORED_INCOMPLETE")
        self.assertEqual(r["censoredOrPending"],1)
        self.assertIsNone(r["shadowScore"])
    def test_abstentions_never_fake_negative_control(self):
        s,f=prepared(abstain_at=0)
        r=n.grade_shadow_replay(s,f,outcomes(),ASOF)
        self.assertEqual(r["verdict"],"UNSCORED_INCOMPLETE")
        self.assertEqual(r["abstentions"],1)
    def test_future_outcomes_censored(self):
        s,f=prepared()
        r=n.grade_shadow_replay(s,f,outcomes(),DECISION)
        self.assertEqual(r["censoredOrPending"],20)
        self.assertIsNone(r["shadowScore"])
    def test_control_label_requires_full_window(self):
        s,f=prepared()
        data=outcomes();data[10]["monitoringComplete"]=False
        with self.assertRaisesRegex(ValueError,"unverified_control_window"):
            n.grade_shadow_replay(s,f,data,ASOF)
        data=outcomes();data[10]["windowEndAt"]=DECISION
        with self.assertRaisesRegex(ValueError,"unverified_control_window"):
            n.grade_shadow_replay(s,f,data,ASOF)
    def test_source_reuse_and_one_family_rejected(self):
        s,f=prepared();data=outcomes()
        data[10]["sourceFamilies"]=["solana-read-only-rpc","independent"]
        with self.assertRaisesRegex(ValueError,"provenance_insufficient"):
            n.grade_shadow_replay(s,f,data,ASOF)
        data=outcomes();data[11]["sourceFamilies"]=["same","same"]
        with self.assertRaisesRegex(ValueError,"provenance_insufficient"):
            n.grade_shadow_replay(s,f,data,ASOF)
    def test_future_label_retroactivity_rejected(self):
        s,f=prepared();data=outcomes()
        data[0]["observedAt"]=DISCOVERY
        with self.assertRaisesRegex(ValueError,"outcome_lookahead_or_retroactive"):
            n.grade_shadow_replay(s,f,data,ASOF)
    def test_digest_mutation_and_false_authority_rejected(self):
        s,f=prepared()
        tampered=copy.deepcopy(f);tampered["records"][0]["classification"]="REVIEW_HIGH_RISK"
        with self.assertRaisesRegex(ValueError,"decision_digest_invalid"):
            n.grade_shadow_replay(s,tampered,outcomes(),ASOF)
        tampered=copy.deepcopy(s);tampered["cases"][0]["mint"]=pub(90)
        with self.assertRaisesRegex(ValueError,"seal_tampered"):
            n.grade_shadow_replay(tampered,f,outcomes(),ASOF)
    def test_unknown_not_retrospectively_called_nonrug(self):
        s,f=prepared();data=outcomes()
        data[0]["outcomeKind"]="UNKNOWN"
        r=n.grade_shadow_replay(s,f,data,ASOF)
        self.assertEqual(r["verdict"],"UNSCORED_INCOMPLETE")
        self.assertEqual(r["censoredOrPending"],1)
    def test_one_class_even_if_complete_is_unscored(self):
        s,f=prepared(10)
        data=outcomes(10)
        r=n.grade_shadow_replay(s,f,data,ASOF)
        self.assertEqual(r["verdict"],"UNSCORED_INCOMPLETE")
        self.assertIsNone(r["shadowScore"])

if __name__=="__main__":
    unittest.main()
