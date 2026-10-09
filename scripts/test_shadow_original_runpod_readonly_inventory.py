#!/usr/bin/env python3
import importlib.util
import unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location("shadow_readonly",Path(__file__).with_name("shadow-original-runpod-readonly-inventory.py"))
assert spec and spec.loader
tool=importlib.util.module_from_spec(spec);spec.loader.exec_module(tool)
SHA="a"*40
TS="2026-10-08T22:00:00Z"
CPU={"pods":[{"id":"old-shadow","name":"jhadina-shark-shadow","desiredStatus":"EXITED",
               "runtimeStatus":"stopped","networkVolumeId":"nv1",
               "env":[{"key":"SECRET","value":"DO_NOT_EXPOSE"}],
               "sshIp":"1.2.3.4"},
              {"id":"other","name":"production","desiredStatus":"RUNNING"}]}
GPU=[{"id":"gpu-shadow","name":"SHADOW-archival","desiredStatus":"EXITED","networkVolumeId":None}]
VOLUMES={"volumes":[{"id":"nv1","name":"shadow-vault","size":100,
                     "env":{"PASSWORD":"SECRET"}},{"id":"nv2","name":"irrelevant","size":120}]}
class Tests(unittest.TestCase):
    def test_stopped_shadow_pod_found_and_volume_matched(self):
        r=tool.sanitized("RUNPOD_AUTHENTICATED_READ_ONLY_LIST",CPU,GPU,VOLUMES,SHA,TS)
        self.assertEqual(r["podCount"],3)
        self.assertEqual(r["matchingShadowPodCount"],2)
        self.assertEqual(r["matchedVolumeCount"],1)
        self.assertEqual(r["historicalLedgerRecovered"],False)
        self.assertFalse(r["canExecute"])
        self.assertEqual(r["matchingVolumes"][0]["networkVolumeId"],"nv1")
        self.assertNotIn("DO_NOT_EXPOSE",str(r))
        self.assertNotIn("sshIp",str(r))
    def test_empty_pods_does_not_mean_old_data_lost(self):
        r=tool.sanitized("RUNPOD_AUTHENTICATED_READ_ONLY_LIST",[],[],[],SHA,TS)
        self.assertEqual(r["matchingShadowPodCount"],0)
        self.assertEqual(r["candidateStatus"],"POD_METADATA_ONLY_ORIGINAL_DATA_UNVERIFIED")
        self.assertFalse(r["backupRestored"])
    def test_cli_list_wrapper_and_nested_volume_object(self):
        r=tool.sanitized("READ_ONLY",{"items":[{"id":"p","name":"shadow","networkVolume":{"id":"nv5"}}]},
                        {"pods":[]},{"items":[{"networkVolumeId":"nv5","sizeGb":40}]},SHA,TS)
        self.assertEqual(r["matchedVolumeCount"],1)
    def test_bad_shape_or_head_fails_closed(self):
        with self.assertRaises(ValueError):
            tool.sanitized("READ_ONLY",{"random":[]},[],[],SHA,TS)
        with self.assertRaises(ValueError):
            tool.sanitized("READ_ONLY",[],[],[],"not-a-sha",TS)
    def test_normalizer_is_deterministic_except_timestamp(self):
        a=tool.sanitized("READ_ONLY",CPU,GPU,VOLUMES,SHA,TS)
        b=tool.sanitized("READ_ONLY",CPU,GPU,VOLUMES,SHA,TS)
        self.assertEqual(a["inventoryHash"],b["inventoryHash"])
if __name__=="__main__":
    unittest.main()
