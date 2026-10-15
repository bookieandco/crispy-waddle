import datetime as dt
import json
import unittest
from five_lab_models import assemble,capital,social_music,business,discovery,game_qa

D=dt.date(2026,10,15)
def quotes(when='2026-10-15T12:36:00Z',bid=99,ask=101):
 return {'capital':{'observation_status':'VERIFIED_PROVIDER_RESPONSE','source_response_sha256':'a'*64,
                    'observation':{'provider_timestamp':when,'metric':'btc_usd_price','value':100},
                    'domain_evidence':{'status':'OBSERVED','bid_usd':bid,'ask_usd':ask}},
         'business':{'domain_evidence':{'sample_opportunities':[
             {'number':'A-1','title':'Small business research and technology','agency':'Agency','close_date_unverified':'2026-11-01'},
             {'number':'A-2','title':'Other','agency':'Agency','close_date_unverified':'2026-01-01'}]}},
         'social_music':{'domain_evidence':{'sample_count':3}},
         'tv_music':{'domain_evidence':{'sample_items':[{'id':'1','name':'Planet Earth','genre':'TV','official_catalog_link_present':True}]}},
         'tv_music_catalog':{'domain_evidence':{'sample_items':[{'id':'2','name':'Jazz Hour','genre':'Jazz','official_catalog_link_present':True}]}}}
def results():return [{'lab':name,'status':'PASS'} for name in ('capital','social_music','business','tv_music','game_qa')]
class FiveLabTests(unittest.TestCase):
 def test_capital_open_only_paper_and_has_friction(self):
  o=capital(quotes(),None,'2026-10-15T12:37:00Z')
  self.assertEqual(o['mode'],'PAPER_ONLY')
  self.assertIsNone(o['closed_paper_trade'])
  self.assertEqual(o['open_position']['authority'],'PAPER_ONLY')
  self.assertEqual(o['open_position']['target_date_utc'],'2026-10-16')
  self.assertEqual(o['state']['equity_usd'],1000)
  self.assertIsNone(o['state']['sample_sharpe_like_unannualized'])
 def test_capital_next_day_bid_exit_net_cost_and_drawdown(self):
  old=capital(quotes(),None,'2026-10-15T12:37:00Z')
  old_record={'lab_experiments':{'capital':old}}
  curr=capital(quotes('2026-10-16T12:36:00Z',97,99),old_record,'2026-10-16T12:37:00Z')
  trade=curr['closed_paper_trade']
  self.assertLess(trade['net_pnl_usd'],0)
  self.assertLess(curr['state']['equity_usd'],1000)
  self.assertGreater(curr['state']['max_drawdown_pct'],0)
  self.assertEqual(curr['state']['samples'],1)
  self.assertTrue(trade['observed_only_not_executed'])
 def test_capital_rejects_stale_invalid_and_future_quote(self):
  for q in (quotes('2026-10-14T12:36:00Z'),quotes('2026-10-15T13:38:00Z'),quotes(bid=105,ask=100)):
   self.assertIsNone(capital(q,None,'2026-10-15T12:37:00Z')['open_position'])
 def test_capital_sharpe_like_requires_multiple_days(self):
  p=None
  for offset in range(3):
   date=D+dt.timedelta(days=offset)
   day=date.isoformat()
   o=capital(quotes(day+'T12:36:00Z',99-offset,101-offset),p,day+'T12:37:00Z')
   p={'lab_experiments':{'capital':o}}
  self.assertEqual(o['state']['samples'],2)
  self.assertIsNotNone(o['state']['sample_sharpe_like_unannualized'])
 def test_missing_target_quote_carries_unsettled_case_not_second_entry(self):
  previous=capital(quotes(),None,'2026-10-15T12:37:00Z')
  original=previous['open_position']
  unpriced=capital(quotes('2026-10-15T12:36:00Z'),{'lab_experiments':{'capital':previous}},'2026-10-16T12:37:00Z')
  self.assertTrue(unpriced['unresolved_prior_position'])
  self.assertEqual(unpriced['unresolved_reason'],'TARGET_DAY_MARKET_QUOTE_UNAVAILABLE')
  self.assertEqual(unpriced['open_position'],original)
  self.assertIsNone(unpriced['closed_paper_trade'])
  self.assertIsNone(unpriced['new_paper_entry'])
  self.assertEqual(unpriced['state']['samples'],0)
 def test_past_due_case_cannot_settle_at_later_price(self):
  previous=capital(quotes(),None,'2026-10-15T12:37:00Z')
  overdue=capital(quotes('2026-10-17T12:36:00Z',80,82),
          {'lab_experiments':{'capital':previous}},'2026-10-17T12:37:00Z')
  self.assertTrue(overdue['unresolved_prior_position'])
  self.assertEqual(overdue['unresolved_reason'],'MISSED_TARGET_DATE_REQUIRES_REVIEW')
  self.assertIsNone(overdue['closed_paper_trade'])
  self.assertIsNone(overdue['new_paper_entry'])
  self.assertEqual(overdue['open_position'],previous['open_position'])
 def test_invalid_prior_position_never_creates_second_trade(self):
  previous=capital(quotes(),None,'2026-10-15T12:37:00Z')
  previous['open_position']['units']=0
  r=capital(quotes('2026-10-16T12:36:00Z',100,101),
            {'lab_experiments':{'capital':previous}},'2026-10-16T12:37:00Z')
  self.assertTrue(r['unresolved_prior_position'])
  self.assertEqual(r['unresolved_reason'],'UNVERIFIABLE_OR_UNSAFE_PRIOR_POSITION')
  self.assertIsNone(r['closed_paper_trade'])
 def test_historical_drawdown_not_erased_after_equity_rebound(self):
  p=None
  output=[]
  for date,bid,ask in ((15,99,101),(16,80,82),(17,125,127),(18,127,129)):
   r=capital(quotes(f'2026-10-{date:02d}T12:36:00Z',bid,ask),p,
             f'2026-10-{date:02d}T12:37:00Z')
   output.append(r)
   p={'lab_experiments':{'capital':r}}
  self.assertGreater(output[1]['state']['max_drawdown_pct'],0)
  self.assertEqual(output[2]['state']['max_drawdown_pct'],output[1]['state']['max_drawdown_pct'])
  self.assertGreaterEqual(output[3]['state']['max_drawdown_pct'],output[1]['state']['max_drawdown_pct'])
 def test_social_release_is_deterministic_simulated_not_real(self):
  a=social_music(D,quotes());b=social_music(D,quotes())
  self.assertEqual(a,b)
  self.assertEqual(len(a['variants']),3)
  self.assertFalse(a['genuine_engagement_verified'])
  self.assertTrue(all(not x['publication_authorized'] for x in a['variants']))
 def test_business_ranks_individuals_but_no_unverified_funding(self):
  data=business(quotes(),D)
  self.assertEqual(data['opportunities'][0]['source_number'],'A-1')
  self.assertEqual(data['opportunities'][0]['days_to_listed_close_date'],17)
  self.assertEqual(data['opportunities'][0]['applicant_eligibility'],'NOT_VERIFIED')
  self.assertIsNone(data['opportunities'][0]['potential_award_usd'])
  self.assertLess(data['opportunities'][1]['score_heuristic_only'],data['opportunities'][0]['score_heuristic_only'])
 def test_discovery_dedup_rank_and_rights_unverified(self):
  feeds=quotes()
  feeds['tv_music_catalog']['domain_evidence']['sample_items'] *= 2
  out=discovery(feeds,'2026-10-15T12:37:00Z')
  self.assertEqual(out['duplicate_rows_removed'],1)
  self.assertEqual(out['authorized_playback_sources'],0)
  self.assertEqual(out['ranked_candidates'][0]['score'],60)
 def test_game_browser_mock_is_not_physical_certification(self):
  out=game_qa(results(),{'status':'PASS','checks':[{'id':'viewport','passed':True}]})
  self.assertFalse(out['actual_iphone_safari_audio_verified'])
  self.assertFalse(out['hardware_touchscreen_verified'])
 def test_complete_suite_covers_exactly_five_labs(self):
  suite=assemble(D,'2026-10-15T12:37:00Z',quotes(),results())
  self.assertEqual(set(suite),{'capital','social_music','business','tv_music','game_qa'})
if __name__=='__main__':unittest.main()
