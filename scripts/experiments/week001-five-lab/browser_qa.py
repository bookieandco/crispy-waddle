#!/usr/bin/env python3
"""Actual headless-Chromium browser probe. No game ROM, media, accounts or hardware claims."""
import argparse
import html
import json
import pathlib
import re
import shutil
import subprocess
import sys

HERE=pathlib.Path(__file__).resolve().parent
def probe(which=shutil.which, run=subprocess.run, fixture=HERE/"browser_qa.html"):
    binary=next((p for exe in ("google-chrome","google-chrome-stable","chromium","chromium-browser") if (p:=which(exe))),None)
    if not binary:
        return {"status":"BROWSER_UNAVAILABLE","checks":[],"audio_route":"NOT_VERIFIED","actual_iphone_safari_verified":False}
    cmd=[binary,"--headless=new","--disable-gpu","--disable-dev-shm-usage","--no-sandbox",
         "--window-size=390,844","--virtual-time-budget=3000","--dump-dom",fixture.as_uri()]
    try:
        proc=run(cmd,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=35,check=False)
        document=proc.stdout.decode("utf-8","replace")
    except (subprocess.TimeoutExpired,OSError):
        return {"status":"BROWSER_ERROR","checks":[],"audio_route":"NOT_VERIFIED","actual_iphone_safari_verified":False}
    match=re.search(r'<pre\b[^>]*id="results"[^>]*data-ready="true"[^>]*>(.*?)</pre>',document,re.S)
    if not match:
        return {"status":"BROWSER_NOT_READY","checks":[],"audio_route":"NOT_VERIFIED","actual_iphone_safari_verified":False,
                "chrome_exit_code":proc.returncode}
    try:
        result=json.loads(html.unescape(match.group(1)))
    except (ValueError,TypeError):
        return {"status":"BAD_BROWSER_RECEIPT","checks":[],"audio_route":"NOT_VERIFIED","actual_iphone_safari_verified":False}
    checks=result.get("checks",[])
    expected={"web_audio_node_creation","keyboard_down_plus_a_spin","standard_gamepad_mapping_contract","tap_spin_charge_release",
              "touch_pointer_cancel_release","touch_button_release","responsive_screen_not_clipped",
              "touch_targets_48px","controls_inside_viewport"}
    observed={c.get("id") for c in checks if isinstance(c,dict) and c.get("passed") is True}
    if proc.returncode or not expected.issubset(observed) or len(checks)!=len(expected):
        result["status"]="FAIL"
    if result.get("actual_iphone_safari_verified") is not False:
        result["status"]="FAIL"
    result["browser_engine"]="CHROMIUM_HEADLESS"
    result["code_path"]="real_chromium_executes_static_local_js"
    return result

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--output",required=True)
    args=ap.parse_args()
    result=probe()
    dest=pathlib.Path(args.output)
    dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_text(json.dumps(result,sort_keys=True,indent=2)+"\n")
    print(json.dumps({"status":result.get("status"),"checks":len(result.get("checks",[])),"audio_route":result.get("audio_route")}))
    return 0 if result.get("status")=="PASS" else 1

if __name__=="__main__":
    sys.exit(main())
