from __future__ import annotations
import argparse,json,sqlite3
from pathlib import Path

def columns(con:sqlite3.Connection,table:str)->set[str]:
 safe=table.replace('"','""');return {r[1].lower() for r in con.execute('pragma table_info("'+safe+'")')}

def pick(tables:list[str],prefix:str,required:set[str],con:sqlite3.Connection)->list[str]:
 return [t for t in tables if t.startswith(prefix) and required.issubset(columns(con,t))]

def main()->None:
 p=argparse.ArgumentParser(description="Discover nbadb tables by schema capabilities, never guessed names")
 p.add_argument("sqlite_path");p.add_argument("--output",default="artifacts/kaggle/capabilities.json");args=p.parse_args()
 con=sqlite3.connect("file:"+str(Path(args.sqlite_path).resolve())+"?mode=ro",uri=True)
 tables=[r[0] for r in con.execute("select name from sqlite_master where type='table' order by name")]
 capabilities={
  "gameIdentity":pick(tables,"dim_",{"game_id"},con),
  "playerIdentity":pick(tables,"dim_",{"player_id"},con),
  "teamIdentity":pick(tables,"dim_",{"team_id"},con),
  "gameFacts":pick(tables,"fact_",{"game_id"},con),
  "playerGameFacts":pick(tables,"fact_",{"game_id","player_id"},con),
  "teamGameFacts":pick(tables,"fact_",{"game_id","team_id"},con)
 }
 con.close();out=Path(args.output);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(capabilities,indent=2),encoding="utf-8");print(json.dumps({k:len(v) for k,v in capabilities.items()}))
if __name__=="__main__":main()
