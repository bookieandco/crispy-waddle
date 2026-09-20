from __future__ import annotations
import argparse,hashlib,json,sqlite3
from pathlib import Path

def digest(path:Path)->str:
 h=hashlib.sha256()
 with path.open("rb") as f:
  while True:
   b=f.read(1048576)
   if not b:break
   h.update(b)
 return h.hexdigest()

def main()->None:
 p=argparse.ArgumentParser(description="Read-only inventory for the downloaded nbadb SQLite export")
 p.add_argument("sqlite_path");p.add_argument("--output",default="artifacts/kaggle/schema-inventory.json");args=p.parse_args()
 db=Path(args.sqlite_path);con=sqlite3.connect("file:"+str(db.resolve())+"?mode=ro",uri=True)
 names=[r[0] for r in con.execute("select name from sqlite_master where type='table' order by name")]
 tables=[]
 for name in names:
  escaped=name.replace('"','""')
  columns=[{"name":r[1],"type":r[2],"notNull":bool(r[3]),"primaryKey":bool(r[5])} for r in con.execute('pragma table_info("'+escaped+'")')]
  count=con.execute('select count(*) from "'+escaped+'"').fetchone()[0]
  tables.append({"table":name,"columns":columns,"rowCount":count})
 con.close()
 receipt={"dataset":"wyattowalsh/basketball","format":"sqlite","databaseSha256":digest(db),"tableCount":len(tables),"tables":tables}
 out=Path(args.output);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(receipt,indent=2),encoding="utf-8");print(json.dumps({"databaseSha256":receipt["databaseSha256"],"tableCount":len(tables)}))
if __name__=="__main__":main()
