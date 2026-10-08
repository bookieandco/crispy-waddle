"""Hermetic tests for isolated JetStream API restore, no actual server/network."""
import hashlib
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import nats_restore_drill as r


def receipt():
    return {
        "schema": "jhadina.google-homebase.jetstream-backup.v1",
        "scope": "ONE_NATS_STREAM_WITH_CONSUMER_SNAPSHOT",
        "encrypted_with_restic": True,
        "remote_bytes_restored_verified": True,
        "nats_archive_offline_validated": True,
        "stream": "JHADINA_EVENTS",
        "snapshot_id": "a"*64,
        "sha256_archive_manifest": "b"*64,
    }


def env():
    return {
        "JHADINA_NATS_RESTORE_TRUST_DOMAIN": "OWNER_CONTROLLED",
        "JHADINA_NATS_RESTORE_APPROVED": "YES",
        "GOOGLE_HOMEBASE_RCLONE_REMOTE": "jhadina-drive",
        "GOOGLE_HOMEBASE_BACKUP_FOLDER_ID": "FAKE_BACKUP_FOLDER_12345",
        "RESTIC_PASSWORD_FILE": "/secure/restic",
    }


def make_archive(folder):
    folder.mkdir(parents=True, exist_ok=True)
    (folder/"backup.json").write_text('{"stream":"JHADINA_EVENTS"}')
    (folder/"stream.arc.s2").write_bytes(b"archive-data-from-nats")


class NatsRestoreTests(unittest.TestCase):
    def test_rejects_untrusted_and_missing_receipt_authority(self):
        r.owner_trust(env())
        for bad in (
            {"JHADINA_NATS_RESTORE_APPROVED":"NO"},
            {"JHADINA_NATS_RESTORE_TRUST_DOMAIN":"GITHUB_RUNNER"},
            {"GITHUB_ACTIONS":"true"},
        ):
            with self.subTest(bad=bad), self.assertRaises(r.JetstreamRestoreError):
                r.owner_trust({**env(), **bad})
        for bad in (
            {"scope":"ALL_NATS"},
            {"encrypted_with_restic":False},
            {"nats_archive_offline_validated":False},
            {"stream":"../escape"},
            {"snapshot_id":"latest"},
            {"sha256_archive_manifest":"fake"},
        ):
            with self.subTest(bad=bad), self.assertRaises(r.JetstreamRestoreError):
                r.validate_source_receipt({**receipt(), **bad})

    def test_requires_owner_only_private_receipt_before_remote(self):
        with tempfile.TemporaryDirectory() as tmp:
            fp=Path(tmp)/"receipt.json"
            fp.write_text(json.dumps(receipt()))
            os.chmod(fp,0o644)
            with patch.object(r.backup,"remote_check") as remote:
                with self.assertRaisesRegex(r.JetstreamRestoreError,"owner-only"):
                    r.drill(fp,env())
                remote.assert_not_called()

    def test_mismatched_restore_hash_never_starts_server(self):
        with tempfile.TemporaryDirectory() as tmp:
            fp=Path(tmp)/"receipt.json"
            fp.write_text(json.dumps(receipt()))
            os.chmod(fp,0o600)
            class Result:
                returncode=0
            def simulated_restic(args,cwd,*,timeout=180,capture=False):
                if args[0]=="restic" and "restore" in args:
                    make_archive(Path(args[args.index("--target")+1])/"nats-stream-backup")
                return Result()
            with patch.object(r.backup,"require_password_file"), \
                 patch.object(r.backup,"require_binary"), \
                 patch.object(r.backup,"remote_check"), \
                 patch.object(r.nats_backup,"execute",side_effect=simulated_restic), \
                 patch.object(r,"detached_server_drill") as host:
                with self.assertRaisesRegex(r.JetstreamRestoreError,"SHA256 differs"):
                    r.drill(fp,env())
                host.assert_not_called()

    def test_isolated_nats_api_drill_only_binds_loopback(self):
        with tempfile.TemporaryDirectory() as tmp:
            class Response:
                def __init__(self,rc=0,data=b""):
                    self.returncode=rc
                    self.stdout=data
            class Server:
                def __init__(self): self.stopped=False
                def poll(self): return None if not self.stopped else 0
                def terminate(self): self.stopped=True
                def wait(self,timeout=8): return 0
                def kill(self): self.stopped=True
            server=Server()
            def simulate(args,cwd,*,timeout=180,capture=False):
                if "stream" in args and "info" in args:
                    return Response(data=json.dumps({
                        "config":{"name":"JHADINA_EVENTS"},
                        "state":{"messages":12,"last_seq":12}
                    }).encode())
                return Response()
            with patch.object(r.nats_backup.backup,"require_binary"), \
                 patch.object(r,"local_port",return_value=52345), \
                 patch.object(r.subprocess,"Popen",return_value=server) as launch, \
                 patch.object(r.nats_backup,"execute",side_effect=simulate) as cli:
                count=r.detached_server_drill(Path(tmp)/"archive","JHADINA_EVENTS",Path(tmp))
                self.assertEqual(count,12)
                self.assertTrue(server.stopped)
                opts=launch.call_args.args[0]
                self.assertIn("127.0.0.1",opts)
                self.assertIn("52345",opts)
                self.assertNotIn("0.0.0.0",opts)
                self.assertEqual(cli.call_args_list[0].args[0][-2:],["stream","ls"])
                restore=cli.call_args_list[-2].args[0]
                self.assertEqual(restore[:5],["nats","--server","nats://127.0.0.1:52345","backup","restore"])

    def test_success_receipt_only_proves_data_not_ack_positions(self):
        with tempfile.TemporaryDirectory() as tmp:
            fp=Path(tmp)/"receipt.json"
            fp.write_text(json.dumps(receipt()))
            os.chmod(fp,0o600)
            class Result:
                returncode=0
            def sim(args,cwd,*,timeout=180,capture=False):
                if args[0]=="restic" and "restore" in args:
                    make_archive(Path(args[args.index("--target")+1])/"nats-stream-backup")
                return Result()
            with tempfile.TemporaryDirectory() as manifestdir:
                original=Path(manifestdir)/"snapshot"
                make_archive(original)
                hash_,_,_=r.nats_backup.archive_manifest(original)
            data={**receipt(),"sha256_archive_manifest":hash_}
            fp.write_text(json.dumps(data))
            with patch.object(r.backup,"require_password_file"), \
                 patch.object(r.backup,"require_binary"), \
                 patch.object(r.backup,"remote_check"), \
                 patch.object(r.nats_backup,"execute",side_effect=sim), \
                 patch.object(r,"detached_server_drill",return_value=42) as drill:
                result=r.drill(fp,env())
            self.assertTrue(result["nats_api_restore_tested"])
            self.assertFalse(result["consumer_ack_positions_tested"])
            self.assertFalse(result["production_nats_mutated"])
            self.assertEqual(result["restored_message_count"],42)
            drill.assert_called_once()


if __name__=="__main__":
    unittest.main()
