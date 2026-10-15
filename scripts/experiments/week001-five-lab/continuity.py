"""Canonical first-day anchor for the seven-day five-lab experiment.

These constants were verified directly against the genuine successful October 14,
2026 scheduled GitHub Actions artifact 11895992213 / run 38567194569.
The archive was also backed up to the owner's Google Drive.
"""
import datetime as dt

FIRST_DATE=dt.date(2026,10,14)
FIRST_RECORD_SHA256="910fe4bc96bde0ca57f158ae605b5f731293f1d691538eeeeebc33da3b519e04"
FIRST_RUN_ID=38567194569
FIRST_PREDICTION_SHA256={
    "capital":"05cd6f674a85e3d283651bb0f87af9c554003103ca514b181c982e7b191d00e4",
    "social_music":"6b6031204ff78749ee295187ae489bf3e8d9310108e1a3a0d93c2a35f0fc5a85",
    "business":"18a0232b0b0702ea5a2e4d95bd6285f80555267c85a85c636b0ece01c31a6fd8",
    "tv_music":"84852cb0ec560ab71f59d3d21a2db73cb99c678af4fea472725f8c3f1dc4c8f8",
    "tv_music_catalog":"739f579c30f653a61a630a25bcc004ddac5df95c42817c75f08c974bdadc339a",
    "game_qa":"6e64daa3114ea0b6171a29fa539b83144505d57b1804d8093b58f0687ce5c1bf",
}

def verify_genesis(record):
    if not isinstance(record,dict):return False
    if record.get("record_sha256")!=FIRST_RECORD_SHA256:return False
    if record.get("date")!=FIRST_DATE.isoformat():return False
    if record.get("preflight") is not False or record.get("dry_run") is not False:return False
    if record.get("financial_authority")!="NONE" or record.get("publication_authority")!="NONE":return False
    preds=record.get("predictions")
    if not isinstance(preds,list) or len(preds)!=len(FIRST_PREDICTION_SHA256):return False
    observed={x.get("source"):x.get("prediction_sha256") for x in preds if isinstance(x,dict)}
    if observed!=FIRST_PREDICTION_SHA256:return False
    if any(x.get("execute_authority") is not False or x.get("publication_authority") is not False for x in preds):return False
    return True

def prior_research_date_valid(record,expected_date):
    """Strict UTC date, no preflight/settlement replays for the prior daily record."""
    if not isinstance(record,dict):return False
    if record.get("date")!=expected_date.isoformat():return False
    if record.get("preflight") is not False or record.get("dry_run") is not False:return False
    if record.get("settlement") is not False:return False
    if record.get("financial_authority")!="NONE" or record.get("publication_authority")!="NONE":return False
    if record.get("paid_services_authorized") is not False:return False
    return True
