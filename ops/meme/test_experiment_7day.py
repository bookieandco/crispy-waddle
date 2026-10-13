import copy
import importlib.util
import pathlib
import unittest

p = pathlib.Path(__file__).with_name('experiment_7day.py')
spec = importlib.util.spec_from_file_location('meme_experiment', p)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

MINT = 'So11111111111111111111111111111111111111112'
PAIR = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
T1 = '2026-10-14T01:00:00Z'
T2 = '2026-10-14T01:30:00Z'


def market(price=2, liq=100000, pair=PAIR):
    return {'chainId': 'solana', 'baseToken': {'address': MINT},
            'quoteToken': {'address': 'other-quote'}, 'pairAddress': pair,
            'priceUsd': str(price), 'liquidity': {'usd': liq},
            'dexId': 'pumpswap', 'pairCreatedAt': 1791900000000}


def feed(price=2, liq=100000, pair=PAIR):
    return ([{'chainId': 'solana', 'tokenAddress': MINT}], [], [market(price, liq, pair)])


class SevenDay(unittest.TestCase):
    def test_no_wallet_permission_and_provenance_chain(self):
        state = m.empty_state()
        result = m.sample(state, feed(), T1, T1)
        self.assertEqual(result['sampled'], 1)
        self.assertFalse(state['cases'][MINT]['canTrade'])
        self.assertEqual(state['cases'][MINT]['securityStatus'], 'UNVERIFIED')
        self.assertIn('MINT_FREEZE_LP_CONTROL_AND_HOLDERS_UNVERIFIED', state['events'][0]['flags'])
        self.assertEqual(state['events'][0]['rugVerdict'], 'UNDETERMINED')
        m.audit(state)
        bad = copy.deepcopy(state)
        bad['events'][0]['priceUsd'] = 1000
        with self.assertRaisesRegex(ValueError, 'digest'):
            m.audit(bad)

    def test_never_calls_crash_confirmed_rug(self):
        state = m.empty_state()
        m.sample(state, feed(), T1, T1)
        m.sample(state, feed(.2, 12000), T2, T2)
        flags = state['events'][1]['flags']
        self.assertIn('SUSPECTED_LIQUIDITY_DRAIN_NOT_PROVEN_RUG', flags)
        self.assertIn('PRICE_COLLAPSE_NOT_PROVEN_RUG', flags)
        self.assertEqual(state['events'][1]['rugVerdict'], 'UNDETERMINED')
        self.assertFalse(state['events'][1]['canTrade'])
        m.audit(state)

    def test_switch_censors_outcome(self):
        state = m.empty_state()
        m.sample(state, feed(), T1, T1)
        alt = '11111111111111111111111111111111'
        m.sample(state, feed(.1, 20000, alt), '2026-10-15T01:30:00Z', '2026-10-15T01:30:00Z')
        self.assertEqual(state['cases'][MINT]['baselineClass'], 'CENSORED_PAIR_SWITCH')
        self.assertIsNone(state['cases'][MINT]['first24hMark'])
        self.assertNotIn('SUSPECTED_LIQUIDITY_DRAIN_NOT_PROVEN_RUG', state['events'][1]['flags'])
        m.sample(state, feed(5), '2026-10-15T02:00:00Z', '2026-10-15T02:00:00Z')
        self.assertIsNone(state['cases'][MINT]['first24hMark'])

    def test_cross_chain_and_bad_prices_not_studied(self):
        state = m.empty_state()
        docs = ([{'chainId': 'ethereum', 'tokenAddress': MINT}], [], [market()])
        self.assertEqual(m.sample(state, docs, T1, T1)['sampled'], 0)
        self.assertIsNone(m.choose_pair([market(float('nan'), 10000)], MINT))
        self.assertIsNone(m.choose_pair([market(10, -1)], MINT))

    def test_future_data_and_out_of_window_rejected(self):
        s = m.empty_state()
        with self.assertRaisesRegex(ValueError, 'availability_before'):
            m.sample(s, feed(), T2, T1)
        with self.assertRaisesRegex(ValueError, 'outside_experiment_window'):
            m.sample(s, feed(), m.END, m.END)
        self.assertEqual(len(s['events']), 0)

    def test_horizon_scored_only_from_later_same_pair(self):
        s = m.empty_state()
        m.sample(s, feed(), T1, T1)
        m.sample(s, feed(3), '2026-10-15T01:30:00Z', '2026-10-15T01:30:00Z')
        mark = s['cases'][MINT]['first24hMark']
        self.assertEqual(mark['returnPctPriceOnly'], 50)
        self.assertTrue(mark['up'])
        self.assertFalse(s['cases'][MINT]['canTrade'])


if __name__ == '__main__':
    unittest.main()
