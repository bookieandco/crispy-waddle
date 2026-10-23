"""Hermetic acceptance tests for SHARK-GOODCRYPTO.01-.05; no secrets/network."""
import copy
import unittest
from datetime import datetime, timedelta, timezone

import shark_goodcrypto_paper as bot

MINT = '9' * 32
T0 = datetime(2026, 10, 23, 18, 0, tzinfo=timezone.utc)

def ts(delta=0):
    return (T0 + timedelta(milliseconds=delta)).isoformat(timespec='milliseconds').replace('+00:00','Z')

def raw(**changes):
    d = dict(chain='solana',mint=MINT,source=bot.PUBLIC,sourceId='public-feed:synthetic-001',
        observedAt=ts(-200),availableAt=ts(-100),priceUsd='0.001',
        liquidityUsd='25000',volumeUsd5m='7500',holders=500,top10Pct='24',
        marketCapUsd='250000',riskFlags=[],sellRouteObserved=True)
    d.update(changes)
    return d

def q(now=ts(), **changes):
    d = dict(availableAt=now,roundTripLatencyMs=600,buySlippageBps='50',sellSlippageBps='75',
        buyFeeBps='30',sellFeeBps='30',priorityFeeUsd='0.001',mevExposureBps='50',
        sellDepthUsd='1000',quoteSource='synthetic-independent-quote',quoteId='q-1')
    d.update(changes)
    return d

class GoodCryptoPaperTests(unittest.TestCase):
    def test_01_public_observation_sealed_deterministically(self):
        a = bot.normalize(raw(),received_at=ts())
        self.assertEqual(a, bot.normalize(raw(),received_at=ts()))
        self.assertEqual(a['sourceAttested'],False)
        self.assertEqual(a['authority'],'RESEARCH_ONLY')
        self.assertFalse(a['canTrade'])
        self.assertEqual(a['ageMsAtReceipt'],100)

    def test_01_unrecognized_private_sources_and_unknown_fields_block(self):
        for record in (raw(source='TELEGRAM_PRIVATE'),raw(chatText='buy now'),
                       raw(sourceId=''),raw(mint='x'),raw(priceUsd='NaN'),
                       raw(top10Pct='101'),raw(holders='20')):
            with self.subTest(record=record),self.assertRaises(ValueError):
                bot.normalize(record,received_at=ts())

    def test_01_stale_future_and_backdated_observation_block(self):
        for record,when in ((raw(availableAt=ts(-30001)),ts()),
                            (raw(availableAt=ts(200)),ts()),
                            (raw(observedAt=ts(100)),ts())):
            with self.subTest(record=record), self.assertRaises(ValueError):
                bot.normalize(record,received_at=when)

    def test_02_rug_and_liquidity_veto_strong_even_with_price(self):
        for change in (dict(riskFlags=['CREATOR_CLUSTER']),dict(sellRouteObserved=False),
                       dict(top10Pct='82'),dict(liquidityUsd='3'),
                       dict(volumeUsd5m='0'),dict(holders=2)):
            result = bot.screen(bot.normalize(raw(**change),received_at=ts()))
            self.assertEqual(result['decision'],'REVIEW')
            self.assertTrue(result['reasons'])
            self.assertFalse(result['canTrade'])

    def test_02_user_supplied_research_not_promoted_to_entry(self):
        obs = bot.normalize(raw(source=bot.USER),received_at=ts())
        self.assertEqual(bot.screen(obs)['decision'],'REVIEW')
        self.assertEqual(bot.paper_entry(obs,q(),received_at=ts())['action'],'NO_ENTRY')

    def test_03_quote_missing_stale_high_fee_and_mev_fail_closed(self):
        for bad in (q(availableAt=ts(-5001)),q(availableAt=ts(200)),q(mevExposureBps='2001'),
                    q(roundTripLatencyMs=2001),q(sellDepthUsd='0'),
                    q(buySlippageBps='1400',buyFeeBps='150',mevExposureBps='150')):
            with self.subTest(bad=bad),self.assertRaises(ValueError):
                bot.quote_cost(bad, received_at=ts())
        with self.assertRaises(ValueError):
            bot.quote_cost({**q(), 'walletPrivateKey':'leak'},received_at=ts())

    def test_04_paper_entry_inert_and_size_depth_bound(self):
        obs = bot.normalize(raw(),received_at=ts())
        entry = bot.paper_entry(obs,q(),received_at=ts())
        self.assertEqual(entry['action'],'SIMULATED_ENTRY_CANDIDATE')
        self.assertFalse(entry['canTrade'])
        self.assertFalse(entry['fillVerified'])
        self.assertTrue(entry['paperOnly'])
        self.assertEqual(entry['paperProposalId'],bot.paper_entry(obs,q(),received_at=ts())['paperProposalId'])
        with self.assertRaises(ValueError):
            bot.paper_entry(obs,q(),received_at=ts(),position_usd='50')
        self.assertEqual(bot.paper_entry(obs,q(sellDepthUsd='50'),received_at=ts())['action'],'NO_ENTRY')

    def test_05_marks_are_hypothetical_never_realized(self):
        e = bot.paper_entry(bot.normalize(raw(),received_at=ts()),q(),received_at=ts())
        held = bot.paper_mark(e,mark_price_usd='.0011',mark_at=ts(1000),high_water_price_usd='.0011')
        self.assertEqual(held['status'],'OPEN_UNSCORED')
        tp = bot.paper_mark(e,mark_price_usd='.0015',mark_at=ts(1000),high_water_price_usd='.0015',
                            quoted_exit=q(ts(1000)))
        self.assertEqual(tp['trigger'],'TAKE_PROFIT')
        self.assertEqual(tp['status'],'HYPOTHETICAL_PRICE_ONLY')
        self.assertIsNone(tp['realizedPnlUsd'])
        self.assertFalse(tp['executionVerified'])
        stopped = bot.paper_mark(e,mark_price_usd='.0008',mark_at=ts(1000),high_water_price_usd='.0012',
                                 quoted_exit=q(ts(1000)))
        self.assertEqual(stopped['trigger'],'STOP')
        trailed = bot.paper_mark(e,mark_price_usd='.0011',mark_at=ts(1000),high_water_price_usd='.0015',
                                 quoted_exit=q(ts(1000)))
        self.assertEqual(trailed['trigger'],'TRAIL')
        missing = bot.paper_mark(e,mark_price_usd='.0015',mark_at=ts(1000),high_water_price_usd='.0015')
        self.assertEqual(missing['status'],'EXIT_UNSCORED_NO_QUOTE')
        shallow = bot.paper_mark(e,mark_price_usd='.0015',mark_at=ts(1000),high_water_price_usd='.0015',
                                 quoted_exit=q(ts(1000),sellDepthUsd='100'))
        self.assertEqual(shallow['status'],'EXIT_UNSCORED_INADEQUATE_DEPTH')

    def test_05_shadow_envelope_review_only_no_authority(self):
        entry = bot.paper_entry(bot.normalize(raw(),received_at=ts()),q(),received_at=ts())
        env = bot.shadow_envelope(entry)
        self.assertTrue(env['requiresIndependentMoneyValidation'])
        self.assertTrue(env['requiresMimsTradeVote'])
        self.assertEqual(env['decision'],'REVIEW_ONLY')
        self.assertFalse(env['admittedToPurse'])
        self.assertFalse(env['signing'])
        self.assertFalse(env['walletAccess'])
        self.assertEqual(env,bot.shadow_envelope(entry))

    def test_05_no_pnl_from_untrusted_or_stale_exit(self):
        e = bot.paper_entry(bot.normalize(raw(),received_at=ts()),q(),received_at=ts())
        bad = bot.paper_mark(e,mark_price_usd='.0016',mark_at=ts(10000),
                             high_water_price_usd='.0016',quoted_exit=q())
        self.assertEqual(bad['status'],'EXIT_UNSCORED_BAD_QUOTE')
        self.assertIsNone(bad['hypotheticalNetUsd'])
        with self.assertRaises(ValueError):
            bot.paper_mark(e,mark_price_usd='.0016',mark_at=ts(),high_water_price_usd='.0016')

if __name__ == '__main__':
    unittest.main()
