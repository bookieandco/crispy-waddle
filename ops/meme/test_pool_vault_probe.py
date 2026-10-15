"""Offline safety regressions for actual Solana-owned pool/vault account bytes."""
import base64
import importlib.util
import pathlib
import unittest
HERE=pathlib.Path(__file__).parent
spec=importlib.util.spec_from_file_location("pool_vault_probe",HERE/"pool_vault_probe.py")
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

TIME="2026-10-14T23:00:00Z"
MINT=m.encode_pubkey(bytes([6])*32)
QUOTE=m.encode_pubkey(bytes([7])*32)
BASEVAULT=m.encode_pubkey(bytes([8])*32)
QUOTEV=m.encode_pubkey(bytes([9])*32)
POOL=m.encode_pubkey(bytes([10])*32)
PROGRAM=m.solana.TOKEN_PROGRAMS
TOKEN="TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
def bytekey(addr):
    n=0
    for c in addr:
        n=n*58+m.B58.index(c)
    return n.to_bytes(32,"big")
def fixture(dex="pumpswap",mutate=None):
    program,length,offsets=m.PROGRAMS[dex]
    raw=bytearray(length)
    for pos,addr in zip(offsets,[MINT,QUOTE,BASEVAULT,QUOTEV]):
        raw[pos:pos+32]=bytekey(addr)
    if mutate:mutate(raw)
    pool={"context":{"slot":100},"value":{"owner":program,"data":[base64.b64encode(raw).decode(),"base64"]}}
    pair={"dex":dex,"mint":MINT,"quoteMint":QUOTE,"pair":POOL,"digest":"market-observation-receipt"}
    return pair,pool
def vault(account,mint,atoms):
    return {"context":{"slot":101},"value":{"owner":TOKEN,"data":{"parsed":{"type":"account",
             "info":{"mint":mint,"owner":m.encode_pubkey(bytes([17])*32),
                     "tokenAmount":{"amount":str(atoms),"decimals":6}}}}}}
def fake_rpc_factory(pool):
    calls=[]
    def fn(method,params):
        assert method=="getAccountInfo"
        calls.append((params[0],params[1]["encoding"]))
        if params[0]==POOL:return pool
        if params[0]==BASEVAULT:return vault(BASEVAULT,MINT,555000)
        if params[0]==QUOTEV:return vault(QUOTEV,QUOTE,333000)
        raise AssertionError("unexpected account request")
    return fn,calls
def seeded():
    s=m.observer.empty_state()
    m.observer.append_event(s,{"type":"MARKET_OBSERVATION",
        "mint":MINT,"pair":POOL,"quoteMint":QUOTE,"dex":"pumpswap",
        "observedAt":TIME,"availableAt":TIME,
        "securityStatus":"UNVERIFIED","canTrade":False})
    m.observer.append_event(s,{"type":"CYCLE","observedAt":TIME,"availableAt":TIME})
    return s

class PoolVaultReadOnlyTests(unittest.TestCase):
    def test_real_bytes_mint_mapping_and_vault_amounts(self):
        for venue in ("pumpswap","raydium"):
            pair,pool=fixture(venue)
            fn,calls=fake_rpc_factory(pool)
            out=m.probe_pair(pair,fn,TIME)
            self.assertEqual(out["status"],"ONCHAIN_VAULT_BALANCES_PARTIAL_UNVERIFIED")
            self.assertEqual(out["baseVault"]["atoms"],"555000")
            self.assertEqual(out["quoteVault"]["atoms"],"333000")
            self.assertFalse(out["coverage"]["liquidityControl"])
            self.assertFalse(out["coverage"]["sellability"])
            self.assertFalse(out["canTrade"])
            self.assertEqual(calls,[(POOL,"base64"),(BASEVAULT,"jsonParsed"),(QUOTEV,"jsonParsed")])

    def test_pool_owner_spoof_rejected(self):
        pair,pool=fixture()
        pool["value"]["owner"]="not-original-pool-program"
        with self.assertRaisesRegex(ValueError,"pool_owner_program_mismatch"):
            m.probe_pair(pair,fake_rpc_factory(pool)[0],TIME)

    def test_pair_mint_mismatch_rejected_before_vault_calls(self):
        pair,pool=fixture()
        pair["mint"]=m.encode_pubkey(bytes([22])*32)
        fn,calls=fake_rpc_factory(pool)
        with self.assertRaisesRegex(ValueError,"pool_mint_identity_mismatch"):
            m.probe_pair(pair,fn,TIME)
        self.assertEqual(len(calls),1)

    def test_wrong_token_vault_mint_rejected(self):
        pair,pool=fixture()
        fn,calls=fake_rpc_factory(pool)
        def corrupt(method,params):
            result=fn(method,params)
            if params[0]==BASEVAULT:result["value"]["data"]["parsed"]["info"]["mint"]=QUOTE
            return result
        with self.assertRaisesRegex(ValueError,"vault_mint_or_authority_mismatch"):
            m.probe_pair(pair,corrupt,TIME)

    def test_stale_slot_never_partial_verified(self):
        pair,pool=fixture()
        fn,calls=fake_rpc_factory(pool)
        def old(method,params):
            result=fn(method,params)
            if params[0]==BASEVAULT:result["context"]["slot"]=99
            return result
        with self.assertRaisesRegex(ValueError,"vault_slot_older_than_pool"):
            m.probe_pair(pair,old,TIME)

    def test_hash_linked_no_trading_and_cycle_idempotence(self):
        state=seeded()
        p,pool=fixture()
        fn,calls=fake_rpc_factory(pool)
        def prober(pair):
            return m.probe_pair(pair,fn,TIME)
        first=m.reconcile(state,TIME,prober=prober)
        self.assertEqual(first["newProbe"],1)
        self.assertEqual(first["status"],"ONCHAIN_VAULT_BALANCES_PARTIAL_UNVERIFIED")
        self.assertEqual(m.reconcile(state,TIME,prober=prober)["newProbe"],0)
        self.assertEqual(len(calls),3)
        self.assertFalse(state["events"][-1]["canBroadcast"])
        m.observer.audit(state)

    def test_provider_failure_remains_unverified_not_safe(self):
        state=seeded()
        record=m.reconcile(state,TIME,prober=lambda pair: (_ for _ in ()).throw(ValueError("rpc outage")))
        self.assertEqual(record["status"],"POOL_RPC_UNVERIFIED")
        self.assertFalse(state["events"][-1]["isRugConfirmed"])
        self.assertFalse(state["events"][-1]["canTrade"])

    def test_venue_restricted_and_no_execution(self):
        pair,pool=fixture()
        pair["dex"]="raydium-clmm"
        with self.assertRaisesRegex(ValueError,"unsupported_dex_venue"):
            m.probe_pair(pair)
        with self.assertRaisesRegex(ValueError,"disallowed_rpc_method"):
            m.solana.rpc("sendTransaction",[])

if __name__=="__main__":unittest.main()
