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
  self.assertEqual(out['ranked_candidates'][0]['score'],70)
 def test_game_browser_mock_is_not_physical_certification(self):
  out=game_qa(results(),{'status':'PASS','checks':[{'id':'viewport','passed':True}]})
  self.assertFalse(out['actual_iphone_safari_audio_verified'])
  self.assertFalse(out['hardware_touchscreen_verified'])
 def test_complete_suite_covers_exactly_five_labs(self):
  suite=assemble(D,'2026-10-15T12:37:00Z',quotes(),results())
  self.assertEqual(set(suite),{'capital','social_music','business','tv_music','game_qa'})
if __name__=='__main__':unittest.main()
