import hashlib
import json
import tempfile
import unittest
from pathlib import Path

import numpy as np
import soundfile as sf
from stem_bounce import render_dry_stem_set, verify_dry_stem_null


class EditedStemExport(unittest.TestCase):
    def setUp(self):
        t=tempfile.TemporaryDirectory();self.addCleanup(t.cleanup)
        self.root=Path(t.name)
        self.audio=self.root/"source";self.audio.mkdir()
        self.rate=48000
        self.assets=[];self.tracks=[]
        for idx, frequency in enumerate((110,220),start=1):
            time=np.arange(self.rate)/self.rate
            arr=np.column_stack((np.sin(2*np.pi*frequency*time)*.1,
                                 np.cos(2*np.pi*frequency*time)*.1))
            path=self.audio/f"stem-{idx}.wav"
            sf.write(path,arr,self.rate,subtype="FLOAT")
            digest=hashlib.sha256(path.read_bytes()).hexdigest()
            aid=f"stem-{idx}"
            self.assets.append(dict(id=aid,sha256=digest,
                localPath=path.name,sampleRate=self.rate,sampleCount=self.rate))
            self.tracks.append(dict(artifactId=aid,sourceSha256=digest,
                durationSeconds=1,gainDb=0,pan=0,mute=False,solo=False,
                eq=dict(lowDb=0,midDb=0,highDb=0),
                compressor=dict(enabled=False,thresholdDb=-18,ratio=2),
                pluginRack=[],automation={},clips=[dict(
                    id=f"clip-{idx}",startSeconds=0,endSeconds=1 if idx==1 else .6,
                    sourceOffsetSeconds=0,fadeInSeconds=0,fadeOutSeconds=0)]))
        self.session=dict(schemaVersion="jhadina-music-daw/v1",caseId="case-1",
                          revision=5,tempoBpm=None,tracks=self.tracks)
        self.dest=self.root/"edited-export"

    def render(self):
        return render_dry_stem_set(self.session,self.assets,self.audio,self.dest)

    def test_two_tracks_full_length_and_independent_pcm_null(self):
        hashes={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in self.audio.iterdir()}
        report=self.render()
        self.assertEqual(report["sampleCount"],self.rate)
        self.assertEqual(len(report["stems"]),2)
        self.assertEqual(report["stems"][0]["trackName"],"stem-1")
        handoff=json.loads((self.dest/"DIRECTOR-AUDIO-HANDOFF.json").read_text())
        self.assertEqual(handoff["sourceReceiptSha256"],report["receiptSha256"])
        self.assertEqual(handoff["sampleCount"],report["sampleCount"])
        self.assertEqual(handoff["trackFiles"][0]["outputSha256"],
                         report["stems"][0]["outputSha256"])
        self.assertEqual(handoff["registrationStatus"],
                         "pending-owner-scoped-media-registration")
        self.assertTrue(handoff["needsOwnerReview"])
        self.assertFalse(handoff["restorationCertified"])
        guide=(self.dest/"IMPORT-INTO-DAW.txt").read_text(encoding="utf-8")
        self.assertIn("stems/track-01.wav | stem-1 | role=stem | artifact=stem-1\n",guide)
        self.assertNotIn(r"artifact=stem-1\n",guide)
        self.assertTrue(report["readbackNullQc"]["passed"])
        self.assertFalse(report["restorationCertified"])
        with sf.SoundFile(self.dest/"stems"/"track-02.wav") as f:
            self.assertEqual(f.frames,self.rate)
            f.seek(int(.9*self.rate))
            self.assertTrue(np.array_equal(f.read(50,dtype="float32"),np.zeros((50,2))))
        self.assertEqual(hashes,{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in self.audio.iterdir()})
        with self.assertRaisesRegex(ValueError,"OUTPUT_LOCATION_INVALID"):
            self.render()

    def test_solo_and_mute_are_preserved(self):
        self.tracks[1]["solo"]=True
        self.tracks[0]["mute"]=True
        report=self.render()
        self.assertEqual(len(report["stems"]),1)
        self.assertEqual(report["stems"][0]["artifactId"],"stem-2")
        self.assertEqual(report["sampleCount"],int(.6*self.rate))

    def test_edits_affect_stem_and_mix_equally(self):
        self.tracks[0]["automation"]={"gainDb":[{"atSeconds":0,"value":-12},
                    {"atSeconds":1,"value":0}]}
        self.tracks[1]["pan"]=-1
        report=self.render()
        self.assertTrue(report["readbackNullQc"]["passed"])
        with sf.SoundFile(self.dest/"stems"/"track-02.wav") as f:
            a=f.read(dtype="float32")
        self.assertLess(float(np.max(np.abs(a[:,1]))),1e-5)

    def test_null_detects_corrupt_edited_stem(self):
        self.render()
        p=self.dest/"stems"/"track-01.wav"
        with sf.SoundFile(p,mode="r+") as f:
            f.seek(12);f.write(np.ones((1,2),dtype="float32"))
        with self.assertRaisesRegex(ValueError,"NULL_MIX_MISMATCH"):
            verify_dry_stem_null(self.dest/"mix.wav",[p,self.dest/"stems"/"track-02.wav"])

    def test_dsp_refuses_and_leaves_no_output(self):
        self.tracks[0]["eq"]["lowDb"]=2
        with self.assertRaisesRegex(ValueError,"ACTIVE_DSP"):
            self.render()
        self.assertFalse(self.dest.exists())

    def test_output_location_fails_closed(self):
        with self.assertRaisesRegex(ValueError,"OUTPUT_LOCATION_INVALID"):
            render_dry_stem_set(self.session,self.assets,self.audio,
                                self.audio/"output")

if __name__=="__main__": unittest.main()
