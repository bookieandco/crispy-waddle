import unittest
from grant_details import parse_detail,enrich_grants,MAX_DETAILS
from five_lab_models import business
import datetime as dt

class OfficialOpportunityDetails(unittest.TestCase):
 def test_parses_numeric_ceiling_and_applicant_categories_not_eligibility(self):
  doc={'errorcode':0,'data':{'id':22,'synopsis':{'awardCeiling':'1,200,000','awardFloor':'20,000',
   'applicantTypes':[{'id':'A','description':'Small businesses'}]}}}
  x=parse_detail(doc,22)
  self.assertEqual(x['award_ceiling_usd'],1200000)
  self.assertEqual(x['applicant_type_descriptions'],['Small businesses'])
  self.assertFalse(x['applicant_eligibility_confirmed'])
 def test_identity_mismatch_and_negative_amount(self):
  with self.assertRaises(ValueError):
   parse_detail({'errorcode':0,'data':{'id':99,'synopsis':{}}},22)
  v=parse_detail({'errorcode':0,'data':{'id':22,'synopsis':{'awardCeiling':'-1'}}},22)
  self.assertIsNone(v['award_ceiling_usd'])
 def test_search_samples_enriched_only_with_verified_matching_detail(self):
  receipt={'domain_evidence':{'sample_opportunities':[{'number':'A-1','opportunity_id':'22','title':'Small business technology',
   'agency':'Agency','close_date_unverified':'11/01/2026'}]}}
  def fetch(ident):
   self.assertEqual(ident,'22')
   return ({'opportunity_id':ident,'award_ceiling_usd':1200000,'award_floor_usd':20000,
     'applicant_type_descriptions':['Small businesses']},'a'*64)
  enrich_grants(receipt,fetch)
  grants=business({'business':receipt},dt.date(2026,10,15))
  item=grants['opportunities'][0]
  self.assertEqual(item['days_to_listed_close_date'],17)
  self.assertEqual(item['potential_award_usd'],1200000)
  self.assertEqual(item['value_score'],25)
  self.assertEqual(item['applicant_eligibility'],'NOT_VERIFIED')
  self.assertEqual(item['funding_value_status'],'OFFICIAL_CEILING_NOT_GUARANTEED')
 def test_missing_details_remain_unverified(self):
  source={'domain_evidence':{'sample_opportunities':[{'number':'A-1','opportunity_id':'22','title':'Business'}]}}
  enrich_grants(source,lambda id:(_ for _ in ()).throw(TimeoutError()))
  self.assertEqual(source['domain_evidence']['sample_opportunities'][0]['detail_status'],'UNAVAILABLE')
  self.assertIsNone(business({'business':source},dt.date(2026,10,15))['opportunities'][0]['potential_award_usd'])
 def test_only_three_public_details_per_pass(self):
  items=[{'number':str(i),'opportunity_id':str(i)} for i in range(10)]
  calls=[]
  enrich_grants({'domain_evidence':{'sample_opportunities':items}},
                lambda ident:(calls.append(ident) or {'opportunity_id':ident},'b'*64))
  self.assertLessEqual(len(calls),MAX_DETAILS)
if __name__=='__main__':unittest.main()
