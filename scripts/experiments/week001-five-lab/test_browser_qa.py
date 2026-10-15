import html
import json
import unittest
from types import SimpleNamespace
from browser_qa import probe

CHECKS=[
 'web_audio_node_creation','keyboard_down_plus_a_spin','standard_gamepad_mapping_contract','tap_spin_charge_release',
 'touch_pointer_cancel_release','touch_button_release','responsive_screen_not_clipped',
 'touch_targets_48px','controls_inside_viewport'
]
class BrowserQATests(unittest.TestCase):
 def test_missing_browser_is_explicit_unverified(self):
  r=probe(which=lambda name:None)
  self.assertEqual(r['status'],'BROWSER_UNAVAILABLE')
  self.assertFalse(r['actual_iphone_safari_verified'])
 def test_headless_result_verified_without_claiming_ios_speakers(self):
  result={'status':'PASS','checks':[{'id':x,'passed':True} for x in CHECKS],
          'audio_route':'REQUIRES_INTERACTIVE_USER_GESTURE','actual_iphone_safari_verified':False}
  dom='<pre id="results" data-ready="true">'+html.escape(json.dumps(result))+'</pre>'
  r=probe(which=lambda name:'/usr/bin/google-chrome',run=lambda *a,**kw:SimpleNamespace(stdout=dom.encode(),stderr=b'',returncode=0))
  self.assertEqual(r['status'],'PASS')
  self.assertEqual(len(r['checks']),9)
  self.assertNotEqual(r['audio_route'],'HARDWARE_VERIFIED')
 def test_missing_touch_assertion_fails_closed(self):
  result={'status':'PASS','checks':[{'id':x,'passed':True} for x in CHECKS[:-1]],
          'actual_iphone_safari_verified':False}
  dom='<pre id="results" data-ready="true">'+html.escape(json.dumps(result))+'</pre>'
  r=probe(which=lambda n:'/usr/bin/chromium',run=lambda *a,**kw:SimpleNamespace(stdout=dom.encode(),stderr=b'',returncode=0))
  self.assertEqual(r['status'],'FAIL')
 def test_unmarked_browser_receipt_cannot_pass(self):
  dom='<pre id="results" data-ready="false">{}</pre>'
  r=probe(which=lambda n:'/usr/bin/chromium',run=lambda *a,**kw:SimpleNamespace(stdout=dom.encode(),stderr=b'',returncode=0))
  self.assertEqual(r['status'],'BROWSER_NOT_READY')
if __name__=='__main__':unittest.main()
