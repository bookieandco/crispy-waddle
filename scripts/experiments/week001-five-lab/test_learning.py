import datetime as dt
import unittest
from copy import deepcopy
from learning import produce, grade, sha, summarize

D=dt.date(2026,10,14)
def feeds(value=100,stamp="2026-10-14T12:36:00Z"):
    return {
        "capital":{"observation_status":"VERIFIED_PROVIDER_RESPONSE","observation":{"metric":"btc_usd_price","value":value,"provider_timestamp":stamp},"source_response_sha256":"a"*64},
        "social_music":{"observation_status":"VERIFIED_PROVIDER_RESPONSE","observation":{"metric":"itunes_catalog_search_result_count","value":10},"source_response_sha256":"b"*64},
        "business":{"observation_status":"VERIFIED_PROVIDER_RESPONSE","observation":{"metric":"posted_business_keyword_grant_count","value":42},"source_response_sha256":"c"*64},
        "tv_music":{"observation_status":"VERIFIED_PROVIDER_RESPONSE","observation":{"metric":"itunes_catalog_search_result_count","value":4},"source_response_sha256":"d"*64},
        "tv_music_catalog":{"observation_status":"VERIFIED_PROVIDER_RESPONSE","observation":{"metric":"itunes_catalog_search_result_count","value":10},"source_response_sha256":"e"*64}
    }
def results(status="PASS"):
    return [{"lab":key,"status":status} for key in ("capital","social_music","business","tv_music","game_qa")]
def prior(predictions, observations=None, preflight=False):
    return {"schema_version":1,"date":D.isoformat(),"predictions":predictions,"feeds":observations or feeds(),"preflight":preflight,"dry_run":False}
class LearningTests(unittest.TestCase):
    def test_sealed_predictions_cover_all_five_labs(self):
        predictions=produce(D,"2026-10-14T12:37:00+00:00",feeds(),results())
        self.assertEqual(len(predictions),6)
        self.assertEqual({p["lab"] for p in predictions},{"capital","social_music","business","tv_music","game_qa"})
        self.assertTrue(all(not p["execute_authority"] and not p["publication_authority"] for p in predictions))
        self.assertTrue(all(p["target_date_utc"]=="2026-10-15" for p in predictions))
        for p in predictions:
            unsigned={k:v for k,v in p.items() if k!="prediction_sha256"}
            self.assertEqual(sha(unsigned),p["prediction_sha256"])
    def test_next_day_grades_source_observation(self):
        p=produce(D,"2026-10-14T12:37:00Z",feeds(),results())
        grades=grade(prior(p),D+dt.timedelta(days=1),"2026-10-15T12:37:00Z",feeds(105,"2026-10-15T12:36:00Z"),results())
        self.assertEqual(len(grades),6)
        capital=next(g for g in grades if g["outcome_kind"]=="market_quote_research_only")
        self.assertEqual(capital["baseline_absolute_error"],5)
        self.assertFalse(capital["investment_performance"])
    def test_never_grades_same_day_or_future_outcome(self):
        p=produce(D,"2026-10-14T12:37:00Z",feeds(),results())
        self.assertEqual(grade(prior(p),D,"2026-10-14T12:38:00Z",feeds(),results()),[])
        self.assertEqual(grade(prior(p),D+dt.timedelta(days=1),"2026-10-14T12:30:00Z",feeds(),results()),[])
    def test_rejects_altered_or_replayed_prediction(self):
        p=produce(D,"2026-10-14T12:37:00Z",feeds(),results())
        p[0]["baseline_value"]=999999
        grades=grade(prior(p),D+dt.timedelta(days=1),"2026-10-15T12:37:00Z",feeds(105),results())
        self.assertEqual(len(grades),5)
        self.assertNotIn("market_quote_research_only",{x["outcome_kind"] for x in grades})
    def test_requires_real_feed_and_test(self):
        bad=feeds()
        bad["capital"]["observation_status"]="UNAVAILABLE"
        states=results()
        states[1]["status"]="FAIL"
        p=produce(D,"2026-10-14T12:37:00Z",bad,states)
        self.assertNotIn("capital",{x["lab"] for x in p})
        self.assertNotIn("social_music",{x["lab"] for x in p})
    def test_challenger_requires_prior_and_no_auto_promotion(self):
        predictions=produce(D+dt.timedelta(days=1),"2026-10-15T12:37:00Z",feeds(110,"2026-10-15T12:36:00Z"),results(),prior([],feeds(100)))
        capital=next(x for x in predictions if x["lab"]=="capital")
        self.assertEqual(capital["baseline_value"],110)
        self.assertEqual(capital["challenger_value"],115)
        self.assertFalse(summarize([{"outcome_kind":"market_quote_research_only","baseline_absolute_error":5,"challenger_absolute_error":2}])["market_quote_research_only"]["challenger_promotion_eligible"])
    def test_stale_quote_does_not_produce_or_grade_a_case(self):
        old=feeds(stamp="2026-10-13T12:00:00Z")
        p=produce(D,"2026-10-14T12:37:00Z",old,results())
        self.assertFalse(any(x["source"]=="capital" for x in p))
        current=produce(D,"2026-10-14T12:37:00Z",feeds(),results())
        grades=grade(prior(current),D+dt.timedelta(days=1),"2026-10-15T12:37:00Z",feeds(105),results())
        self.assertFalse(any(x["outcome_kind"]=="market_quote_research_only" for x in grades))
    def test_rejects_date_mismatched_forward_seal(self):
        with self.assertRaises(ValueError):
            produce(D,"2026-10-15T12:37:00Z",feeds(),results())
    def test_refuse_to_grade_preflight(self):
        p=produce(D,"2026-10-14T12:37:00Z",feeds(),results())
        self.assertEqual(grade(prior(p,preflight=True),D+dt.timedelta(days=1),"2026-10-15T12:37:00Z",feeds(),results()),[])
if __name__=="__main__": unittest.main()
