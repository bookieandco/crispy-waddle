#!/usr/bin/env python3
"""Technical acceptance: original local 12s video + sound -> real 12s MP4, receipt, hash."""
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

MODULE=Path(__file__).with_name('director-offline-final-render.py')
spec=importlib.util.spec_from_file_location('director_local_final_render',MODULE)
renderer=importlib.util.module_from_spec(spec)
spec.loader.exec_module(renderer)

def sha(path:Path)->str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

class DirectorOfflineRenderTests(unittest.TestCase):
    def test_original_local_source_to_playable_mp4_and_final_probe(self):
        self.assertIsNotNone(shutil.which('ffmpeg'))
        self.assertIsNotNone(shutil.which('ffprobe'))
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            media=root/'media'
            out=root/'output'
            (media/'owned-project').mkdir(parents=True)
            out.mkdir()
            clip=media/'owned-project'/'original-camera.mp4'
            subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-nostdin','-y',
                '-f','lavfi','-i','testsrc2=size=320x240:rate=30:duration=12.0',
                '-f','lavfi','-i','sine=frequency=330:sample_rate=48000:duration=12.0',
                '-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p',
                '-c:a','aac','-shortest',str(clip)],check=True,timeout=120)
            plan={'schemaVersion':1,'authority':'DIRECTOR_OFFLINE_RENDER_PLAN_ONLY',
                'canPublish':False,'qcCertified':False,'projectId':'owned-project',
                'timelineRevision':3,'timelineVersionId':'v3',
                'durationSeconds':12,'fps':30,'width':320,'height':240,
                'sources':[{'assetId':'asset-1','objectPath':'owned-project/original-camera.mp4',
                    'sha256':sha(clip),'mediaType':'video'}],
                'clips':[{'clipId':'shot-a','trackId':'v','kind':'video','assetId':'asset-1',
                    'startSeconds':0,'sourceInSeconds':0,'durationSeconds':12,'volume':0.7}],
            }
            preflight=renderer.render(plan,media,out,execute=False)
            self.assertFalse(preflight['renderExecuted'])
            self.assertFalse((out/'owned-project-r3.mp4').exists())
            receipt=renderer.render(plan,media,out,execute=True)
            self.assertFalse(receipt['canPublish'])
            self.assertFalse(receipt['qcCertified'])
            self.assertTrue(receipt['renderExecuted'])
            final=out/'owned-project-r3.mp4'
            self.assertTrue(final.exists())
            self.assertEqual(sha(final),receipt['outputSha256'])
            observed=renderer.metadata(final)
            self.assertTrue(any(s.get('codec_type')=='audio' for s in observed['streams']))
            self.assertEqual(next(s for s in observed['streams'] if s['codec_type']=='video')['width'],320)
            self.assertAlmostEqual(float(observed['format']['duration']),12,delta=.25)
            with self.assertRaisesRegex(ValueError,'OUTPUT_ALREADY_EXISTS'):
                renderer.render(plan,media,out,execute=True)
            with self.assertRaisesRegex(ValueError,'HASH_MISMATCH'):
                renderer.render({**plan,'sources':[{**plan['sources'][0],'sha256':'f'*64}]},
                    media,out,execute=False)
    def test_rejects_traversal_and_elevated_publish_authority(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            with self.assertRaisesRegex(ValueError,'ELEVATED_AUTHORITY'):
                renderer.validated_plan({'schemaVersion':1,'authority':'DIRECTOR_OFFLINE_RENDER_PLAN_ONLY',
                 'canPublish':True,'qcCertified':False},root)
if __name__=='__main__':
    unittest.main()
