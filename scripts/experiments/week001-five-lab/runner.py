#!/usr/bin/env python3
"""Read-only five-lab evaluation. No trading or publishing SDKs."""
import argparse, datetime as dt, hashlib, json, os, pathlib, subprocess, sys, time
from research import collect
from learning import produce, grade, summarize
from domain_evidence import changes
from five_lab_models import assemble
from continuity import FIRST_DATE, verify_genesis, prior_research_date_valid
START=dt.date(2026,10,14)
END=dt.date(2026,10,20)
LABS={
  'capital':['pnpm','--filter','@jhadina/money-core','exec','tsx','--test','src/money-forward-durable-research-cycles.test.ts','src/money-finish-forward-grades.test.ts'],
  'social_music':['pnpm','--filter','@jhadina/social-core','--filter','@jhadina/music-core','test'],
  'business':['pnpm','--filter','@jhadina/opportunity-core','exec','tsx','src/domain/public-source-runtime.test.ts'],
  'tv_music':['pnpm','--filter','@jhadina/tv-core','--filter','@jhadina/music-core','test'],
  'game_qa':['pnpm','--filter','@jhadina/gaming-core','run','certify']
}
def digest(b): return hashlib.sha256(b).hexdigest()
def canonical(obj): return json.dumps(obj,sort_keys=True,separators=(',',':')).encode()
def read_prior(previous, today, anchored=False):
    if not previous: return None
    path=pathlib.Path(previous)
    if not path.exists() or path.stat().st_size>1048576: return None
    try:
        prior=json.loads(path.read_text())
        check=prior.pop('record_sha256')
        if digest(canonical(prior))!=check: return None
        prior['record_sha256']=check
        expected=today-dt.timedelta(days=1)
        if not prior_research_date_valid(prior,expected): return None
        if anchored and expected==FIRST_DATE and not verify_genesis(prior):
            return None
        return prior
    except (OSError,ValueError,TypeError,KeyError): return None

def run_suite(today,output,dry_run=False,repo_root='.',public_feeds=False,previous=None,preflight=False,captured_at=None,settlement=False,browser_file=None,anchored=False):
    if not (preflight or START<=today<=END or (settlement and today==END+dt.timedelta(days=1))): raise ValueError('Outside authorized October 14-21 experiment and settlement window')
    output=pathlib.Path(output)
    output.mkdir(parents=True,exist_ok=True)
    results=[]
    for name,cmd in LABS.items():
        begin=time.monotonic()
        if dry_run:
            status='DRY_RUN_NOT_EXECUTED'; code=None; transcript=b'command not executed; dry-run metadata only\n'
        else:
            try:
                proc=subprocess.run(cmd,cwd=repo_root,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=240,check=False,env={**os.environ,'CI':'true'})
                code=proc.returncode;transcript=proc.stdout[-524288:]
                status='PASS' if code==0 else 'FAIL'
            except subprocess.TimeoutExpired as exc:
                code=None;status='TIMEOUT';transcript=(exc.stdout or b'')[-524288:]
            except OSError as exc:
                code=None;status='ERROR';transcript=str(exc).encode()
        (output/(name+'.log')).write_bytes(transcript)
        results.append({'lab':name,'status':status,'command':cmd,'exit_code':code,'log_sha256':digest(transcript),'duration_seconds':round(time.monotonic()-begin,3),'source_kind':'local_repository_tests','market_feed_verified':False,'external_outcomes_verified':False})
    feeds=collect(enrich=True) if public_feeds else {}
    prior=read_prior(previous,today,anchored=anchored)
    captured_at=captured_at or dt.datetime.now(dt.timezone.utc).isoformat()
    observed_changes=changes(prior,feeds) if public_feeds and prior and not preflight and not dry_run else {}
    browser_result={}
    if browser_file:
        try:
            browser_path=pathlib.Path(browser_file)
            if browser_path.stat().st_size>100000: raise ValueError('Browser evidence unexpectedly large')
            browser_result=json.loads(browser_path.read_text())
        except (OSError,ValueError,TypeError):
            browser_result={'status':'BROWSER_EVIDENCE_INVALID','checks':[]}
    lab_experiments=assemble(today,captured_at,feeds,results,prior,browser_result) if public_feeds and not dry_run else {}
    outcomes=grade(prior,today,captured_at,feeds,results) if public_feeds and prior and not preflight and not dry_run else []
    predictions=produce(today,captured_at,feeds,results,prior) if public_feeds and not preflight and not dry_run and not settlement else []
    if preflight: prior_state='PREFLIGHT_NOT_SCORED'
    elif dry_run: prior_state='DRY_RUN_NOT_SCORED'
    elif today==START: prior_state='FIRST_DAY_NO_PRIOR_REQUIRED'
    elif prior: prior_state='VERIFIED_PRIOR_DAY'
    else: prior_state='MISSING_OR_INVALID_PRIOR_DAY'
    for result in results:
        receipt=feeds.get(result['lab'])
        result['feed_observation_verified']=bool(receipt and receipt['observation_status']=='VERIFIED_PROVIDER_RESPONSE')
        result['market_feed_verified']=bool(result['lab']=='capital' and result['feed_observation_verified'])
        result['external_outcomes_verified']=False
        result['forward_evaluation_cases']=sum(1 for x in outcomes if x['prediction_id'].endswith(':'+result['lab']))
    expected_sources=('capital','social_music','business','tv_music','tv_music_catalog')
    live_observation=public_feeds and not preflight and not dry_run
    health_issues=[]
    if live_observation:
        capital_receipt=lab_experiments.get('capital',{})
        if capital_receipt.get('unresolved_prior_position'):
            health_issues.append('PAPER_POSITION_UNRESOLVED:'+str(capital_receipt.get('unresolved_reason','UNKNOWN')))
        if browser_file and lab_experiments['game_qa']['headless_browser_status']!='PASS':
            health_issues.append('GAME_BROWSER_QA_NOT_VERIFIED')
        for source in expected_sources:
            if feeds.get(source,{}).get('observation_status')!='VERIFIED_PROVIDER_RESPONSE':
                health_issues.append('RESEARCH_SOURCE_UNAVAILABLE:'+source)
        for item in results:
            if item['status']!='PASS':
                health_issues.append('LAB_CERTIFICATION_FAILED:'+item['lab'])
        if today<=END and len(predictions)!=6:
            health_issues.append('INCOMPLETE_SEALED_FORECASTS:'+str(len(predictions))+'/6')
        if today>START and len(outcomes)!=6:
            health_issues.append('INCOMPLETE_VERIFIED_OUTCOMES:'+str(len(outcomes))+'/6')
        if today>START and prior_state!='VERIFIED_PRIOR_DAY':
            health_issues.append('MISSING_OR_INVALID_PRIOR_EVIDENCE')
    health={'status':'DEGRADED' if health_issues else 'HEALTHY' if live_observation else 'NOT_A_LIVE_OBSERVATION',
            'expected_sources':len(expected_sources),
            'verified_sources':sum(feeds.get(source,{}).get('observation_status')=='VERIFIED_PROVIDER_RESPONSE' for source in expected_sources),
            'expected_forecasts':0 if settlement else 6,
            'expected_outcomes':0 if today==START else 6,
            'issues':health_issues}
    record={'lab_experiments':lab_experiments,'lab_experiments_captured_at_utc':captured_at,'browser_qa':browser_result,'domain_changes':observed_changes,'health':health,'settlement':settlement,'preflight':preflight,'feeds':feeds,'outcomes':outcomes,'predictions':predictions,'scorecard':summarize(outcomes),'prior_state':prior_state,'prior_record_sha256':prior.get('record_sha256') if prior else None,'schema_version':1,'date':today.isoformat(),'created_at_utc':dt.datetime.now(dt.timezone.utc).isoformat(),'repository':os.getenv('GITHUB_REPOSITORY','local'),'commit':os.getenv('GITHUB_SHA','uncommitted'),'dry_run':dry_run,'financial_authority':'NONE','publication_authority':'NONE','paid_services_authorized':False,'results':results}
    record['record_sha256']=digest(canonical(record))
    (output/'evidence.json').write_text(json.dumps(record,indent=2,sort_keys=True)+'\n')
    return record
def enforce_non_schedule_preflight(event, preflight=False, settlement=False):
    """Workflow changes and manual reruns never create research observations or grades."""
    if event in ('push','pull_request','workflow_dispatch'):
        return True,False
    if event == 'schedule':
        return False,settlement
    if not event:
        return preflight,settlement
    raise ValueError('Unsupported GitHub event for research runner')

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--date',default=dt.datetime.now(dt.timezone.utc).date().isoformat())
    parser.add_argument('--output',default='experiment-output')
    parser.add_argument('--dry-run',action='store_true')
    parser.add_argument('--research',action='store_true')
    parser.add_argument('--preflight',action='store_true')
    parser.add_argument('--settlement',action='store_true')
    parser.add_argument('--previous',default=None)
    parser.add_argument('--browser-evidence',default=None)
    args=parser.parse_args()
    try:
        args.preflight,args.settlement=enforce_non_schedule_preflight(
            os.getenv('GITHUB_EVENT_NAME',''),args.preflight,args.settlement)
    except ValueError as exc:
        print('BLOCKED: '+str(exc),file=sys.stderr)
        return 1
    try: record=run_suite(dt.date.fromisoformat(args.date),args.output,args.dry_run,public_feeds=args.research,previous=args.previous,preflight=args.preflight,settlement=args.settlement,browser_file=args.browser_evidence,anchored=os.getenv('GITHUB_EVENT_NAME')=='schedule')
    except ValueError as exc:
        print('SKIPPED: '+str(exc),file=sys.stderr)
        return 0
    print(json.dumps({'record_sha256':record['record_sha256'],'statuses':{x['lab']:x['status'] for x in record['results']},'sources':{k:v['observation_status'] for k,v in record['feeds'].items()},'scored_outcomes':len(record['outcomes']),'sealed_predictions':len(record['predictions']),'prior_state':record['prior_state'],'health':record['health']['status'],'issues':record['health']['issues'],'metadata_changes':len(record['domain_changes']),'domain_labs':len(record['lab_experiments'])}))
    return 0 if args.dry_run or (record['health']['status']!='DEGRADED' and all(x['status']=='PASS' for x in record['results'])) else 1
if __name__=='__main__': sys.exit(main())
