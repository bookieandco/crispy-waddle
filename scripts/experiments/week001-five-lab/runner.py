#!/usr/bin/env python3
"""Read-only five-lab evaluation. No trading or publishing SDKs."""
import argparse, datetime as dt, hashlib, json, os, pathlib, subprocess, sys, time
from research import collect
from learning import produce, grade, summarize
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
def read_prior(previous, today):
    if not previous: return None
    path=pathlib.Path(previous)
    if not path.exists() or path.stat().st_size>1048576: return None
    try:
        prior=json.loads(path.read_text())
        check=prior.pop('record_sha256')
        if digest(canonical(prior))!=check: return None
        prior['record_sha256']=check
        if dt.date.fromisoformat(prior['date'])!=today-dt.timedelta(days=1): return None
        return prior
    except (OSError,ValueError,TypeError,KeyError): return None

def run_suite(today,output,dry_run=False,repo_root='.',public_feeds=False,previous=None,preflight=False,captured_at=None,settlement=False):
    if not (START<=today<=END or (preflight and today==START-dt.timedelta(days=1)) or (settlement and today==END+dt.timedelta(days=1))): raise ValueError('Outside authorized October 14-21 experiment and settlement window')
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
    feeds=collect() if public_feeds else {}
    prior=read_prior(previous,today)
    captured_at=captured_at or dt.datetime.now(dt.timezone.utc).isoformat()
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
    record={'settlement':settlement,'preflight':preflight,'feeds':feeds,'outcomes':outcomes,'predictions':predictions,'scorecard':summarize(outcomes),'prior_state':prior_state,'prior_record_sha256':prior.get('record_sha256') if prior else None,'schema_version':1,'date':today.isoformat(),'created_at_utc':dt.datetime.now(dt.timezone.utc).isoformat(),'repository':os.getenv('GITHUB_REPOSITORY','local'),'commit':os.getenv('GITHUB_SHA','uncommitted'),'dry_run':dry_run,'financial_authority':'NONE','publication_authority':'NONE','paid_services_authorized':False,'results':results}
    record['record_sha256']=digest(canonical(record))
    (output/'evidence.json').write_text(json.dumps(record,indent=2,sort_keys=True)+'\n')
    return record
def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--date',default=dt.datetime.now(dt.timezone.utc).date().isoformat())
    parser.add_argument('--output',default='experiment-output')
    parser.add_argument('--dry-run',action='store_true')
    parser.add_argument('--research',action='store_true')
    parser.add_argument('--preflight',action='store_true')
    parser.add_argument('--settlement',action='store_true')
    parser.add_argument('--previous',default=None)
    args=parser.parse_args()
    try: record=run_suite(dt.date.fromisoformat(args.date),args.output,args.dry_run,public_feeds=args.research,previous=args.previous,preflight=args.preflight,settlement=args.settlement)
    except ValueError as exc:
        print('SKIPPED: '+str(exc),file=sys.stderr)
        return 0
    print(json.dumps({'record_sha256':record['record_sha256'],'statuses':{x['lab']:x['status'] for x in record['results']},'sources':{k:v['observation_status'] for k,v in record['feeds'].items()},'scored_outcomes':len(record['outcomes']),'sealed_predictions':len(record['predictions']),'prior_state':record['prior_state']}))
    return 0 if args.dry_run or (all(x['status']=='PASS' for x in record['results']) and record['prior_state']!='MISSING_OR_INVALID_PRIOR_DAY') else 1
if __name__=='__main__': sys.exit(main())
