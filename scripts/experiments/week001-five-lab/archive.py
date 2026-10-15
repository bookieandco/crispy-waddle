#!/usr/bin/env python3
"""Jhadina five-lab deterministic evidence archive + offline restore verification.

Optional Google Drive upload requires explicitly provisioned service-account
credential and a folder shared with that account. Never logs token or key.
"""
import argparse
import base64
import datetime as dt
import hashlib
import io
import json
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile
import urllib.parse
import urllib.request
import uuid
import zipfile

FILES=("evidence.json","browser_qa.json","capital.log","social_music.log","business.log","tv_music.log","game_qa.log")
MAX_FILE=2_000_000
FOLDER="Jhadina five-lab week001"
def digest(data):return hashlib.sha256(data).hexdigest()
def encoded(value):return json.dumps(value,sort_keys=True,separators=(",",":"),allow_nan=False).encode()
def read_json(path):
    return json.loads(pathlib.Path(path).read_text())
def make_archive(directory,archive):
    folder=pathlib.Path(directory)
    evidence=read_json(folder/"evidence.json")
    raw=evidence.copy()
    claimed=raw.pop("record_sha256",None)
    if not claimed or digest(encoded(raw))!=claimed:raise ValueError("Corrupted experiment evidence")
    blobs={}
    for name in FILES:
        source=folder/name
        if source.is_file():
            data=source.read_bytes()
            if len(data)>MAX_FILE:raise ValueError("Oversized evidence: "+name)
            blobs[name]=data
    manifest={"schema":1,"record_sha256":claimed,"date":evidence.get("date"),
              "files":{name:{"sha256":digest(blob),"bytes":len(blob)} for name,blob in sorted(blobs.items())},
              "outcome_type":"AUDIT_BACKUP_NOT_MODEL_CERTIFICATION"}
    blobs["manifest.json"]=encoded(manifest)+b"\n"
    destination=pathlib.Path(archive)
    destination.parent.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(destination,"w",compression=zipfile.ZIP_DEFLATED,compresslevel=6) as bundle:
        for name,data in sorted(blobs.items()):
            meta=zipfile.ZipInfo(name,date_time=(2026,10,14,0,0,0))
            meta.compress_type=zipfile.ZIP_DEFLATED
            meta.external_attr=0o600<<16
            bundle.writestr(meta,data)
    validate_archive(destination)
    return {"record_sha256":claimed,"zip_sha256":digest(destination.read_bytes()),
            "archive_name":destination.name,"file_count":len(blobs)}

def validate_archive(path,restore_dir=None):
    path=pathlib.Path(path)
    if path.stat().st_size>12_000_000:raise ValueError("Archive size exceeds safety limit")
    with zipfile.ZipFile(path) as z:
        names=z.namelist()
        if len(names)!=len(set(names)) or not set(names).issubset(set(FILES)|{"manifest.json"}):
            raise ValueError("Unsafe or duplicate archive member")
        manifest=json.loads(z.read("manifest.json"))
        if set(names)!=(set(manifest.get("files",{}))|{"manifest.json"}):
            raise ValueError("Unmanifested or missing archive file")
        for name,item in manifest.get("files",{}).items():
            if name not in names or name not in FILES:raise ValueError("Unexpected member")
            data=z.read(name)
            if len(data)>MAX_FILE or digest(data)!=item["sha256"] or len(data)!=item["bytes"]:
                raise ValueError("Archive member hash mismatch: "+name)
        evidence=json.loads(z.read("evidence.json"))
        raw={k:v for k,v in evidence.items() if k!="record_sha256"}
        if digest(encoded(raw))!=manifest["record_sha256"] or evidence["record_sha256"]!=manifest["record_sha256"]:
            raise ValueError("Archive evidence record hash mismatch")
        if restore_dir:
            target=pathlib.Path(restore_dir)
            target.mkdir(parents=True,exist_ok=True)
            for name in names:
                (target/name).write_bytes(z.read(name))
    return manifest

def b64url(data):return base64.urlsafe_b64encode(data).decode().rstrip("=")

def service_token(service_account):
    """Short-lived JWT access, no downloaded OAuth keys or user bearer storage."""
    data=json.loads(service_account)
    email=data["client_email"]
    key=data["private_key"]
    token_uri=data.get("token_uri","https://oauth2.googleapis.com/token")
    if token_uri!="https://oauth2.googleapis.com/token" or not email.endswith(".gserviceaccount.com"):
        raise ValueError("Untrusted service account identity or token endpoint")
    now=int(dt.datetime.now(dt.timezone.utc).timestamp())
    header=b64url(encoded({"alg":"RS256","typ":"JWT"}))
    claim=b64url(encoded({"iss":email,"scope":"https://www.googleapis.com/auth/drive.file",
                          "aud":token_uri,"iat":now,"exp":now+1800}))
    unsigned=(header+"."+claim).encode()
    with tempfile.TemporaryDirectory() as folder:
        private=pathlib.Path(folder)/"key.pem"
        private.write_text(key)
        private.chmod(0o600)
        signed=subprocess.run(["openssl","dgst","-sha256","-sign",str(private)],
                              input=unsigned,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=10,check=True)
    assertion=(header+"."+claim+"."+b64url(signed.stdout))
    payload=urllib.parse.urlencode({"grant_type":"urn:ietf:params:oauth:grant-type:jwt-bearer",
                                   "assertion":assertion}).encode()
    request=urllib.request.Request(token_uri,data=payload,method="POST")
    with urllib.request.urlopen(request,timeout=15) as response:token=json.loads(response.read(65536))
    if "access_token" not in token:raise ValueError("Drive service account token unavailable")
    return token["access_token"]

def upload_drive(archive,folder_id,service_account):
    if not folder_id or len(folder_id)>150 or any(c not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-" for c in folder_id):
        raise ValueError("Invalid Drive archive folder ID")
    token=service_token(service_account)
    filepath=pathlib.Path(archive)
    if filepath.stat().st_size>12_000_000:raise ValueError("Archive exceeds Drive upload policy")
    boundary="jh"+uuid.uuid4().hex
    meta={"name":filepath.name,"parents":[folder_id],"description":FOLDER+" immutable evidence ZIP"}
    body=("--"+boundary+"\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n"+
          json.dumps(meta,separators=(",",":"))+"\r\n--"+boundary+
          "\r\nContent-Type: application/zip\r\n\r\n").encode()+filepath.read_bytes()+("\r\n--"+boundary+"--\r\n").encode()
    request=urllib.request.Request("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,md5Checksum",
                                   data=body,method="POST",headers={
        "Authorization":"Bearer "+token,
        "Content-Type":"multipart/related; boundary="+boundary})
    with urllib.request.urlopen(request,timeout=30) as response:remote=json.loads(response.read(65536))
    if not remote.get("id") or remote.get("name")!=filepath.name or int(remote.get("size",-1))!=filepath.stat().st_size:
        raise ValueError("Drive upload did not return a matching object")
    return {"remote_id":remote["id"],"remote_name":remote["name"],
            "size_bytes":filepath.stat().st_size,"zip_sha256":digest(filepath.read_bytes()),
            "remote_md5_checksum":remote.get("md5Checksum"),
            "status":"DRIVE_OBJECT_METADATA_VERIFIED_CONTENT_RESTORE_PENDING"}

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--input",required=True)
    ap.add_argument("--archive",required=True)
    ap.add_argument("--receipt",required=True)
    ap.add_argument("--upload-drive",action="store_true")
    args=ap.parse_args()
    try:
        receipt=make_archive(args.input,args.archive)
        if args.upload_drive:
            account=os.getenv("JHADINA_DRIVE_SERVICE_ACCOUNT_JSON")
            folder=os.getenv("JHADINA_DRIVE_FOLDER_ID")
            if not account or not folder:
                receipt["drive_status"]="NOT_CONFIGURED"
            else:
                receipt["drive"]=upload_drive(args.archive,folder,account)
                receipt["drive_status"]="UPLOADED_NOT_RESTORED"
        dest=pathlib.Path(args.receipt)
        dest.parent.mkdir(parents=True,exist_ok=True)
        dest.write_text(json.dumps(receipt,sort_keys=True,indent=2)+"\n")
        print(json.dumps({"archive":"VERIFIED","record_sha256":receipt["record_sha256"],
                          "zip_sha256":receipt["zip_sha256"],
                          "drive_status":receipt.get("drive_status","NOT_REQUESTED")}))
        return 0
    except (ValueError,KeyError,OSError,subprocess.SubprocessError,zipfile.BadZipFile) as exc:
        print("ARCHIVE_REJECTED:"+type(exc).__name__,file=sys.stderr)
        return 1

if __name__=="__main__":sys.exit(main())
