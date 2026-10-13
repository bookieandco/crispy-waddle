#!/usr/bin/env python3
"""Read-only five-lab evaluation. No trading or publishing SDKs."""
import argparse, datetime as dt, hashlib, json, os, pathlib, subprocess, sys, time
START=dt.date(2026,10,14)
END=dt.date(2026,10,20)
LABS={
  'capital':['pnpm','--filter','@jhadina/money-core','test'],
  'social_music':['pnpm','--filter','@jhadina/social-core','test'],
  'business':['pnpm','--filter','@jhadina/opportunity-core','test'],
  'tv_music':['pnpm','--filter','@jhadina/tv-core','test'],
  'game_qa':['pnpm','--filter','@jhadina/gaming-core','run','certify']
}
def digest(b): return hashlib.sha256(b).hexdigest()
def canonical(obj): return json.dumps(obj,sort_keys=True,separators=(',',':')).encode()
def run_suite(today,output,dry_run=False,repo_root='.'):
    if not START<=today<=END: raise ValueError('Outside approved October 14-20 experiment window')
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
    record={'schema_version':1,'date':today.isoformat(),'created_at_utc':dt.datetime.now(dt.timezone.utc).isoformat(),'repository':os.getenv('GITHUB_REPOSITORY','local'),'commit':os.getenv('GITHUB_SHA','uncommitted'),'dry_run':dry_run,'financial_authority':'NONE','publication_authority':'NONE','paid_services_authorized':False,'results':results}
    record['record_sha256']=digest(canonical(record))
    (output/'evidence.json').write_text(json.dumps(record,indent=2,sort_keys=True)+'\n')
    return record
def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--date',default=dt.datetime.now(dt.timezone.utc).date().isoformat())
    parser.add_argument('--output',default='experiment-output')
    parser.add_argument('--dry-run',action='store_true')
    args=parser.parse_args()
    try: record=run_suite(dt.date.fromisoformat(args.date),args.output,args.dry_run)
    except ValueError as exc:
        print('SKIPPED: '+str(exc),file=sys.stderr)
        return 0
    print(json.dumps({'record_sha256':record['record_sha256'],'statuses':{x['lab']:x['status'] for x in record['results']}}))
    return 0 if args.dry_run or all(x['status']=='PASS' for x in record['results']) else 1
if __name__=='__main__': sys.exit(main())
