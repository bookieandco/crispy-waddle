import unittest
from domain_evidence import evidence, changes, apple_url

class DomainEvidenceTests(unittest.TestCase):
 def test_market_spread_uses_real_bid_ask_not_arbitrary_profit(self):
  out=evidence('capital',{'bid':'99','ask':'101'})
  self.assertEqual(out['status'],'OBSERVED')
  self.assertEqual(out['spread_bps'],200.0)
  self.assertFalse(out['trade_authorized'])
  self.assertLess(out['paper_roundtrip_spread_cost_bps'],200)
  for item in ({'bid':'105','ask':'100'},{'bid':'nan','ask':'101'},{'price':'100'}):
   self.assertEqual(evidence('capital',item)['status'],'UNAVAILABLE')
 def test_itunes_relevance_has_strict_metadata_scope(self):
  doc={'results':[
    {'trackId':1,'trackName':'Night Ride','artistName':'A','primaryGenreName':'Hip-Hop/Rap','trackViewUrl':'https://music.apple.com/us/song/1'},
    {'trackId':1,'trackName':'Duplicated','primaryGenreName':'Pop'},
    {'trackId':2,'trackName':'Ballad','primaryGenreName':'Pop','trackViewUrl':'https://evil.example/song'},
    {'trackId':-1,'trackName':'Invalid'}]}
  v=evidence('social_music',doc)
  self.assertEqual(v['sample_count'],2)
  self.assertEqual(v['simple_query_match_count'],1)
  self.assertEqual(v['official_catalog_links'],1)
  self.assertFalse(v['engagement_verified'])
  self.assertFalse(v['licensed_playback_verified'])
 def test_malicious_official_link_is_rejected(self):
  for url in ['https://music.apple.com.evil.test/track','https://music.apple.com@evil.com/x','http://music.apple.com/x','javascript:alert(1)']:
   self.assertFalse(apple_url(url))
  self.assertTrue(apple_url('https://music.apple.com/us/album/example/123'))
 def test_grants_sample_cannot_claim_qualification(self):
  doc={'data':{'oppHits':[{'number':'ABC-123','title':'Local research','agency':'Agency X','closeDate':'2026-11-01'},
     {'number':'drop me in <html>','title':'bad record'},
     {'number':'DEF-456','title':'Public education'}]}}
  x=evidence('business',doc)
  self.assertEqual(x['sample_count'],2)
  self.assertFalse(x['eligibility_verified'])
  self.assertFalse(x['outreach_authorized'])
 def test_next_day_overlap_requires_actual_both_day_metadata(self):
  def rec(ids):
   return {'observation_status':'VERIFIED_PROVIDER_RESPONSE','source_response_sha256':'a'*64,
    'domain_evidence':{'sample_items':[{'id':str(i)} for i in ids]}}
  previous={'date':'2026-10-14','preflight':False,'feeds':{'social_music':rec([1,2,3])}}
  current={'social_music':rec([2,3,4])}
  metrics=changes(previous,current)
  self.assertEqual(metrics['social_music']['stable_items'],2)
  self.assertEqual(metrics['social_music']['sample_jaccard'],0.5)
  self.assertIn('not_business_or_audience_performance',metrics['social_music']['research_kind'])
  previous['preflight']=True
  self.assertEqual(changes(previous,current),{})
 def test_missing_or_empty_samples_do_not_become_fake_overlap(self):
  self.assertEqual(changes({'feeds':{}},{'social_music':{'observation_status':'VERIFIED_PROVIDER_RESPONSE'}}),{})
if __name__=='__main__':
 unittest.main()
