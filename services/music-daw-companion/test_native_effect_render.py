import os
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).parent))
import scan_plugins
import native_effect_render
import numpy as np
import soundfile as sf

class OptionalNativeDspTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name)
        self.installed=self.root/"plugins";self.installed.mkdir()
        (self.installed/"ApprovedVST.vst3").mkdir()
        self.secret="a"*48
        self.id=scan_plugins.discover_installed_plugins(self.secret,[self.installed])[0]["pluginId"]
        self.wav=self.root/"source.wav"
        t=np.arange(48000)/48000
        signal=np.stack((.1*np.sin(2*np.pi*240*t),.2*np.sin(2*np.pi*400*t)),axis=1)
        sf.write(self.wav,signal,48000,subtype="FLOAT")
        from hashlib import sha256
        self.digest=sha256(self.wav.read_bytes()).hexdigest()
    def render(self,plugin=None,approved=True):
        return native_effect_render.render_native_effect(
            self.wav,self.digest,plugin or self.id,self.root/"output.wav",
            approved,self.secret,[self.installed])
    def test_no_plugin_run_without_manual_opt_in(self):
        with self.assertRaisesRegex(RuntimeError,"NOT_COMMISSIONED"):
            self.render()
    def test_invalid_plugin_id_and_owner_gate(self):
        with patch.dict(os.environ,{"MUSIC_DAW_NATIVE_RENDER_ENABLED":"YES"}):
            with self.assertRaisesRegex(PermissionError,"OWNER_APPROVAL"):
                self.render(approved=False)
            with self.assertRaisesRegex(ValueError,"NOT_IN_LOCAL_INVENTORY"):
                self.render("../../vst3/bad")
    def test_mocked_processor_outputs_real_measured_float_wav(self):
        class Processor:
            def get_name(self): return "immutable_source"
        class Plugin:
            def get_num_input_channels(self): return 2
            def get_num_output_channels(self): return 2
        class Engine:
            def __init__(self,rate,buffer): self.source=None
            def make_playback_processor(self,name,audio): self.source=audio;return Processor()
            def make_plugin_processor(self,name,path): return Plugin()
            def load_graph(self,graph): self.graph=graph
            def render(self,duration): self.duration=duration
            def get_audio(self): return self.source * .75
        with patch.dict(os.environ,{"MUSIC_DAW_NATIVE_RENDER_ENABLED":"YES"}),\
             patch.object(native_effect_render.importlib,"import_module",
                          return_value=SimpleNamespace(RenderEngine=Engine)):
            receipt=self.render()
        self.assertTrue(receipt["nativePluginExecuted"])
        self.assertFalse(receipt["restorationCertified"])
        self.assertFalse(receipt["effectIdentityAttested"])
        self.assertTrue(receipt["sourceImmutable"])
        self.assertEqual(receipt["sampleCount"],48000)
        with sf.SoundFile(self.root/"output.wav") as wav:
            self.assertEqual(wav.subtype,"FLOAT")
            self.assertEqual(len(wav),48000)
        from hashlib import sha256
        self.assertEqual(sha256(self.wav.read_bytes()).hexdigest(),self.digest)
        self.assertEqual(receipt["outputSha256"],sha256((self.root/"output.wav").read_bytes()).hexdigest())
if __name__=="__main__": unittest.main()
