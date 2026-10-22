"""Real local FFmpeg/FFprobe Recast media smoke, NOT a character-swap renderer.

Creates short synthetic clips solely inside a tempfile. No GPU, network,
external user media, Supabase writes, inference, or publish side effects.
"""
from pathlib import Path
import hashlib
import importlib.util
import shutil
import subprocess
import tempfile
import unittest

HERE=Path(__file__).resolve().parent

def read_module(name:str):
    spec=importlib.util.spec_from_file_location(name,HERE/(name+".py"))
    assert spec is not None and spec.loader is not None
    result=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result

probe=read_module("recast_probe")
accept=read_module("recast_preview_acceptance")
audio=read_module("recast_audio_integrity")
def digest(path:Path)->str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

@unittest.skipUnless(shutil.which("ffmpeg") and shutil.which("ffprobe"),"ffmpeg/ffprobe absent; real-media smoke skipped")
class RealMediaSmoke(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name)
        self.original=self.root/"original.mp4"
        self.preview=self.root/"preview.mp4"
        cmd=["ffmpeg","-hide_banner","-nostdin","-loglevel","error",
             "-f","lavfi","-i","color=c=black:s=320x240:r=24",
             "-f","lavfi","-i","sine=frequency=440:sample_rate=16000",
             "-t","1","-c:v","mpeg4","-c:a","aac","-shortest",
             "-y",str(self.original)]
        subprocess.run(cmd,check=True,capture_output=True,timeout=25)
        subprocess.run(["ffmpeg","-hide_banner","-nostdin","-loglevel","error",
                        "-i",str(self.original),"-c","copy","-y",str(self.preview)],
                       check=True,capture_output=True,timeout=25)
    def test_real_decoded_audio_and_container_integrity(self):
        self.assertNotEqual(digest(self.original),digest(self.preview))
        metadata=accept.inspect_recast_local_pair(
            admitted_media_root=str(self.root),
            source_path=str(self.original),preview_path=str(self.preview),
            source_sha256=digest(self.original),preview_sha256=digest(self.preview),
            project_id="synthetic-project",source_asset_id="synthetic-original",
            preview_asset_id="synthetic-remux",runner=subprocess.run)
        self.assertTrue(metadata["metadataConformant"])
        self.assertFalse(metadata["visualIdentityMeasured"])
        self.assertFalse(metadata["lipSyncMeasured"])
        pcm=audio.compare_decoded_original_audio(
            admitted_media_root=str(self.root),
            original_video_path=str(self.original),preview_video_path=str(self.preview),
            original_sha256=digest(self.original),preview_sha256=digest(self.preview))
        self.assertTrue(pcm["decodedAudioExactlyPreserved"])
        self.assertFalse(pcm["independentQualityApproved"])
        self.assertEqual(pcm["publicationAuthority"],"NONE")
    def test_real_decoder_rejects_changed_audio(self):
        altered=self.root/"changed.mp4"
        subprocess.run(["ffmpeg","-hide_banner","-nostdin","-loglevel","error",
                        "-f","lavfi","-i","color=c=black:s=320x240:r=24",
                        "-f","lavfi","-i","sine=frequency=660:sample_rate=16000",
                        "-t","1","-c:v","mpeg4","-c:a","aac","-shortest",
                        "-y",str(altered)],check=True,capture_output=True,timeout=25)
        pcm=audio.compare_decoded_original_audio(
            admitted_media_root=str(self.root),
            original_video_path=str(self.original),preview_video_path=str(altered),
            original_sha256=digest(self.original),preview_sha256=digest(altered))
        self.assertFalse(pcm["decodedAudioExactlyPreserved"])
        self.assertIn("DIRECTOR_RECAST_ORIGINAL_AUDIO_ALTERED",pcm["blockers"])
        self.assertFalse(pcm["lipSyncVerified"])

if __name__=="__main__":
    unittest.main()
