import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch

ROOT=Path(__file__).parent

worker_spec=importlib.util.spec_from_file_location("music_restoration_worker",ROOT/"worker.py")
if worker_spec is None or worker_spec.loader is None:
    raise ImportError("music restoration worker spec unavailable")
worker=importlib.util.module_from_spec(worker_spec)
sys.modules[worker_spec.name]=worker
worker_spec.loader.exec_module(worker)

fetch_spec=importlib.util.spec_from_file_location("music_restoration_source_fetch",ROOT/"source_fetch.py")
if fetch_spec is None or fetch_spec.loader is None:
    raise ImportError("music restoration source fetch spec unavailable")
source_fetch=importlib.util.module_from_spec(fetch_spec)
sys.modules[fetch_spec.name]=source_fetch
fetch_spec.loader.exec_module(source_fetch)

class MusicRestorationWorkerTest(unittest.TestCase):
    def test_receipt_is_deterministic_and_content_bound(self):
        one=worker.receipt_id("music-test",{"b":2,"a":1})
        two=worker.receipt_id("music-test",{"a":1,"b":2})
        three=worker.receipt_id("music-test",{"a":1,"b":3})
        self.assertEqual(one,two)
        self.assertNotEqual(one,three)
        self.assertTrue(one.startswith("music-test:"))

    def test_repair_filter_is_allow_listed(self):
        self.assertIsNone(worker.build_repair_filter("copy",{}))
        self.assertEqual(worker.build_repair_filter("declick",{}),"adeclick")
        self.assertEqual(worker.build_repair_filter("declip",{}),"adeclip")
        self.assertIn("volume=3.000000dB",worker.build_repair_filter("gain",{"gainDb":3}))
        self.assertIn("equalizer=",worker.build_repair_filter("eq",{"frequencyHz":7800,"gainDb":-1.5,"q":1.2}))
        self.assertIn("afftdn=",worker.build_repair_filter("denoise",{"noiseFloorDb":-55}))
        with self.assertRaisesRegex(ValueError,"NOT_ADMITTED"):
            worker.build_repair_filter("shell",{})
        with self.assertRaisesRegex(ValueError,"OUT_OF_RANGE"):
            worker.build_repair_filter("gain",{"gainDb":24})

    def test_convergence_repair_filters_are_bounded(self):
        self.assertIsNone(worker.build_repair_filter("spectral-repair",{}))
        dehum=worker.build_repair_filter("dehum",{
            "fundamentalHz":59.97,"harmonics":4,"q":30,"reductionDb":24,"highpassHz":40,
        })
        self.assertIn("highpass=f=40.000000",dehum)
        self.assertIn("f=59.970000",dehum)
        self.assertIn("f=119.940000",dehum)
        self.assertIn("g=-24.000000",dehum)
        self.assertIn("nr=10.000000",worker.build_repair_filter("denoise",{"noiseFloorDb":-55,"noiseReductionDb":10}))
        with self.assertRaisesRegex(ValueError,"DEHUM_PARAMETERS_INVALID"):
            worker.build_repair_filter("dehum",{"fundamentalHz":5})

    def test_learned_denoise_uses_source_profile_and_records_diagnostics(self):
        with tempfile.TemporaryDirectory() as td:
            config=worker.RestorationWorkerConfig(output_dir=Path(td),demucs_device="cpu")
            source=Path(td)/"source.wav"; source.write_bytes(b"source")
            def fake_probe(path,artifact_id,digest):
                return {
                    "sourceArtifactId":artifact_id,"sourceSha256":digest,"sampleRate":48000,"channels":2,
                    "sampleCount":48000,"durationSeconds":1.0,"codec":"pcm_s24le","lossless":True,
                    "runtimeReceiptId":"probe",
                }
            captured={}
            def fake_run(args,**_kwargs):
                captured["args"]=args
                Path(args[-1]).write_bytes(b"denoised")
                return Mock(returncode=0,stderr=b"")
            with patch.object(worker,"probe_path",side_effect=fake_probe), \
                 patch.object(worker,"learn_noise_profile_path",return_value={
                    "noiseFloorDb":-57.5,"stationarity":0.9,"spectralFlatness":0.8,"confidence":0.88,
                    "lowEnergyRatio":0.2,"midEnergyRatio":0.5,"highEnergyRatio":0.3,
                    "profileStartMs":0.0,"profileEndMs":200.0,
                 }), \
                 patch.object(worker.shutil,"which",return_value="/usr/bin/ffmpeg"), \
                 patch.object(worker.subprocess,"run",side_effect=fake_run):
                receipt=worker.execute_repair_path(
                    source,"source-1","a"*64,"exec-denoise","auth-1","denoise",
                    {"noiseProfileStartMs":0,"noiseProfileEndMs":200,"noiseReductionDb":9},
                    48000,2,config,
                )
            graph=captured["args"][captured["args"].index("-af")+1]
            self.assertIn("nf=-57.500000",graph)
            self.assertIn("nr=9.000000",graph)
            self.assertAlmostEqual(receipt["diagnostics"]["noiseProfileConfidence"],0.88)

    def test_dehum_learns_fundamental_before_render(self):
        with tempfile.TemporaryDirectory() as td:
            config=worker.RestorationWorkerConfig(output_dir=Path(td),demucs_device="cpu")
            source=Path(td)/"source.wav"; source.write_bytes(b"source")
            def fake_probe(path,artifact_id,digest):
                return {
                    "sourceArtifactId":artifact_id,"sourceSha256":digest,"sampleRate":48000,"channels":1,
                    "sampleCount":48000,"durationSeconds":1.0,"codec":"pcm_s24le","lossless":True,
                    "runtimeReceiptId":"probe",
                }
            captured={}
            def fake_run(args,**_kwargs):
                captured["args"]=args
                Path(args[-1]).write_bytes(b"dehummed")
                return Mock(returncode=0,stderr=b"")
            with patch.object(worker,"probe_path",side_effect=fake_probe), \
                 patch.object(worker,"learn_hum_profile_path",return_value={
                    "fundamentalHz":60.34,"harmonicCount":4,"confidence":0.8,
                    "analysisStartMs":0.0,"analysisEndMs":250.0,"strongestHarmonicRatio":12.0,
                 }), \
                 patch.object(worker.shutil,"which",return_value="/usr/bin/ffmpeg"), \
                 patch.object(worker.subprocess,"run",side_effect=fake_run):
                receipt=worker.execute_repair_path(
                    source,"source-1","a"*64,"exec-hum","auth-1","dehum",
                    {"analysisStartMs":0,"analysisEndMs":250,"harmonics":4,"q":30,"reductionDb":30},
                    48000,1,config,
                )
            graph=captured["args"][captured["args"].index("-af")+1]
            self.assertIn("f=60.340000",graph)
            self.assertAlmostEqual(receipt["diagnostics"]["humFundamentalHz"],60.34)

    def test_spectral_repair_dispatches_bounded_time_frequency_executor(self):
        with tempfile.TemporaryDirectory() as td:
            config=worker.RestorationWorkerConfig(output_dir=Path(td),demucs_device="cpu")
            source=Path(td)/"source.wav"; source.write_bytes(b"source")
            def fake_probe(path,artifact_id,digest):
                return {
                    "sourceArtifactId":artifact_id,"sourceSha256":digest,"sampleRate":48000,"channels":2,
                    "sampleCount":96000,"durationSeconds":2.0,"codec":"pcm_s24le","lossless":True,
                    "runtimeReceiptId":"probe",
                }
            def fake_spectral(_source,output,parameters,_rate,_channels):
                self.assertEqual(parameters["startMs"],500)
                self.assertEqual(parameters["lowHz"],1000)
                Path(output).write_bytes(b"spectral-repair")
                return {
                    "spectralRepairStartMs":500.0,"spectralRepairEndMs":520.0,
                    "spectralRepairLowHz":1000.0,"spectralRepairHighHz":12000.0,
                    "spectralRepairBeforeWeight":0.6,"spectralRepairStrength":1.0,
                    "spectralRepairFftSize":2048,"spectralRepairTargetFrames":2,
                }
            with patch.object(worker,"probe_path",side_effect=fake_probe), \
                 patch.object(worker,"_spectral_repair_file",side_effect=fake_spectral), \
                 patch.object(worker.shutil,"which",return_value="/usr/bin/ffmpeg"):
                receipt=worker.execute_repair_path(
                    source,"source-1","a"*64,"exec-spectral","auth-1","spectral-repair",
                    {"startMs":500,"endMs":520,"lowHz":1000,"highHz":12000,"beforeWeight":0.6},
                    48000,2,config,
                )
            self.assertEqual(receipt["operation"],"spectral-repair")
            self.assertEqual(receipt["diagnostics"]["spectralRepairTargetFrames"],2)

    def test_probe_binds_dimensions_and_hash(self):
        payload={
            "streams":[{
                "codec_name":"flac",
                "sample_rate":"48000",
                "channels":2,
                "bits_per_sample":24,
                "duration":"2.5",
            }],
            "format":{"duration":"2.5","format_name":"flac"},
        }
        with patch.object(worker.shutil,"which",return_value="/usr/bin/ffprobe"), \
             patch.object(worker.subprocess,"check_output",return_value=json.dumps(payload)):
            receipt=worker.probe_path(Path("/tmp/source.flac"),"artifact-1","a"*64)
        self.assertEqual(receipt["sampleRate"],48000)
        self.assertEqual(receipt["channels"],2)
        self.assertEqual(receipt["sampleCount"],120000)
        self.assertEqual(receipt["sourceSha256"],"a"*64)
        self.assertTrue(receipt["lossless"])
        self.assertTrue(receipt["runtimeReceiptId"].startswith("music-probe:"))

    def test_readiness_fails_closed_when_runtime_missing(self):
        with tempfile.TemporaryDirectory() as td:
            config=worker.RestorationWorkerConfig(output_dir=Path(td))
            with patch.object(worker.shutil,"which",return_value=None), \
                 patch.object(worker.importlib.util,"find_spec",return_value=None):
                state=worker.runtime_readiness(config)
        self.assertFalse(state["productionReady"])
        self.assertIn("MUSIC_RESTORATION_FFMPEG_REQUIRED",state["reasons"])
        self.assertIn("MUSIC_RESTORATION_DEMUCS_REQUIRED",state["reasons"])

    def test_readiness_can_pass_with_required_runtime(self):
        with tempfile.TemporaryDirectory() as td:
            config=worker.RestorationWorkerConfig(output_dir=Path(td),demucs_device="cpu")
            with patch.object(worker.shutil,"which",side_effect=lambda name:f"/usr/bin/{name}"), \
                 patch.object(worker.importlib.util,"find_spec",return_value=object()):
                state=worker.runtime_readiness(config)
        self.assertTrue(state["productionReady"])
        self.assertEqual(state["reasons"],[])
        self.assertEqual(state["demucsDevice"],"cpu")

    def test_readiness_requires_cuda_when_explicitly_configured(self):
        with tempfile.TemporaryDirectory() as td:
            config=worker.RestorationWorkerConfig(output_dir=Path(td),demucs_device="cuda")
            real_import=__import__
            class TorchStub:
                class cuda:
                    @staticmethod
                    def is_available():
                        return False
            def fake_import(name,*args,**kwargs):
                if name=="torch":
                    return TorchStub
                return real_import(name,*args,**kwargs)
            with patch.object(worker.shutil,"which",side_effect=lambda name:f"/usr/bin/{name}"), \
                 patch.object(worker.importlib.util,"find_spec",return_value=object()), \
                 patch("builtins.__import__",side_effect=fake_import):
                state=worker.runtime_readiness(config)
        self.assertFalse(state["productionReady"])
        self.assertIn("MUSIC_RESTORATION_CUDA_REQUIRED",state["reasons"])

    def test_instrument_assessment_derives_gain_from_audio_metrics(self):
        source_metrics={
            "fingerprint":{
                "family":"drums","spectralCentroidHz":2500.0,"spectralSpreadHz":3000.0,
                "lowEnergyRatio":0.35,"midEnergyRatio":0.45,"highEnergyRatio":0.20,
                "transientStrength":0.9,"harmonicity":0.1,"dynamicRangeDb":8.0,
            },
            "damageScore":0.72,"qualityScore":0.28,"clippingRatio":0.004,
            "dropoutRatio":0.15,"durationMs":500.0,"peak":1.0,
        }
        donor_metrics={
            "fingerprint":{
                "family":"drums","spectralCentroidHz":2550.0,"spectralSpreadHz":2950.0,
                "lowEnergyRatio":0.34,"midEnergyRatio":0.46,"highEnergyRatio":0.20,
                "transientStrength":0.88,"harmonicity":0.11,"dynamicRangeDb":13.0,
            },
            "damageScore":0.08,"qualityScore":0.92,"clippingRatio":0.0,
            "dropoutRatio":0.02,"durationMs":600.0,"peak":0.9,
        }
        with patch.object(worker,"_instrument_audio_metrics",side_effect=[source_metrics,donor_metrics]):
            receipt=worker.assess_instrument_replacement_path(
                Path("/tmp/source.wav"),Path("/tmp/donor.wav"),
                "source-1","a"*64,"donor-1","b"*64,
                "assessment-1","drums",
                [{"sourceStartMs":1000,"sourceEndMs":1500,"replacementStartMs":2000,"replacementEndMs":2600}],
            )
        self.assertAlmostEqual(receipt["gainEvidence"]["expectedGain"],0.64)
        self.assertGreaterEqual(receipt["gainEvidence"]["confidence"],0.7)
        self.assertEqual(receipt["observedFingerprint"]["family"],"drums")
        self.assertEqual(receipt["replacementFingerprint"]["family"],"drums")
        self.assertTrue(receipt["runtimeReceiptId"].startswith("music-instrument-assessment:"))

    def test_reconstruction_segment_is_bounded(self):
        segment=worker._reconstruction_segment({
            "targetStartMs":1000,"targetEndMs":1500,
            "replacementStartMs":2000,"replacementEndMs":2600,
            "gainDb":-1.5,"sourceResidualMix":0.08,"fadeMs":20,"phaseInvert":False,
        },5000,5000)
        self.assertAlmostEqual(segment["tempo"],1.2)
        envelope=worker._source_envelope(segment)
        self.assertIn("between(t,1.000000000,1.020000000)",envelope)
        with self.assertRaisesRegex(ValueError,"TIME_FIT_OUT_OF_RANGE"):
            worker._reconstruction_segment({
                "targetStartMs":1000,"targetEndMs":1100,
                "replacementStartMs":0,"replacementEndMs":1000,
                "gainDb":0,"sourceResidualMix":0.05,"fadeMs":10,"phaseInvert":False,
            },5000,5000)

    def test_reconstruction_renders_two_source_filter_graph(self):
        with tempfile.TemporaryDirectory() as td:
            config=worker.RestorationWorkerConfig(output_dir=Path(td),demucs_device="cpu")
            source=Path(td)/"source.wav"; source.write_bytes(b"source")
            donor=Path(td)/"donor.wav"; donor.write_bytes(b"donor")
            probe_values={
                str(source):{
                    "sourceArtifactId":"source-1","sourceSha256":"a"*64,"sampleRate":48000,"channels":2,
                    "sampleCount":240000,"durationSeconds":5.0,"codec":"pcm_s24le","lossless":True,
                    "runtimeReceiptId":"probe-source",
                },
                str(donor):{
                    "sourceArtifactId":"donor-1","sourceSha256":"b"*64,"sampleRate":44100,"channels":1,
                    "sampleCount":220500,"durationSeconds":5.0,"codec":"pcm_s24le","lossless":True,
                    "runtimeReceiptId":"probe-donor",
                },
            }
            def fake_probe(path,artifact_id,digest):
                if Path(path).name=="output.wav":
                    return {
                        "sourceArtifactId":artifact_id,"sourceSha256":digest,"sampleRate":48000,"channels":2,
                        "sampleCount":240000,"durationSeconds":5.0,"codec":"pcm_s24le","lossless":True,
                        "runtimeReceiptId":"probe-output",
                    }
                return probe_values[str(path)]
            def fake_normalize(_source,destination,_rate,_channels):
                Path(destination).write_bytes(b"normalized-donor")
            captured={}
            def fake_run(args,**_kwargs):
                captured["args"]=args
                Path(args[-1]).write_bytes(b"reconstructed-wav")
                return Mock(returncode=0,stderr=b"")
            with patch.object(worker,"probe_path",side_effect=fake_probe), \
                 patch.object(worker,"normalize_to_wav",side_effect=fake_normalize), \
                 patch.object(worker.shutil,"which",return_value="/usr/bin/ffmpeg"), \
                 patch.object(worker.subprocess,"run",side_effect=fake_run):
                receipt=worker.execute_reconstruction_path(
                    source,donor,"source-1","a"*64,"donor-1","b"*64,
                    "job-1","request-1","approval-1",
                    [{
                        "targetStartMs":1000,"targetEndMs":1500,
                        "replacementStartMs":2000,"replacementEndMs":2600,
                        "gainDb":-1.5,"sourceResidualMix":0.08,"fadeMs":20,"phaseInvert":True,
                    }],
                    48000,2,config,
                )
            graph=captured["args"][captured["args"].index("-filter_complex")+1]
            self.assertIn("atempo=1.200000000",graph)
            self.assertIn("volume=-1",graph)
            self.assertIn("adelay=delays=1000.000:all=1",graph)
            self.assertIn("amix=inputs=2",graph)
            self.assertEqual(receipt["sourceArtifactId"],"source-1")
            self.assertEqual(receipt["replacementArtifactId"],"donor-1")
            self.assertEqual(receipt["segmentCount"],1)
            self.assertTrue(receipt["runtimeReceiptId"].startswith("music-reconstruction:"))

    def test_vocal_repair_segment_is_bounded(self):
        segment=worker._vocal_repair_segment({
            "startMs":1000,"endMs":1400,"operation":"denoise",
            "parameters":{"noiseFloorDb":-55},
            "sourceResidualMix":0.08,"fadeMs":20,
        },5000)
        self.assertIn("afftdn=",segment["filterGraph"])
        self.assertEqual(segment["operation"],"denoise")
        with self.assertRaisesRegex(ValueError,"GAIN_OUT_OF_RANGE"):
            worker._vocal_repair_segment({
                "startMs":1000,"endMs":1400,"operation":"gain",
                "parameters":{"gainDb":7},
                "sourceResidualMix":0.08,"fadeMs":20,
            },5000)

    def test_vocal_restoration_renders_localized_same_source_and_reports_preservation(self):
        with tempfile.TemporaryDirectory() as td:
            config=worker.RestorationWorkerConfig(output_dir=Path(td),demucs_device="cpu")
            source=Path(td)/"vocals.wav"
            source.write_bytes(b"source-vocals")
            source_probe={
                "sourceArtifactId":"vocals-1","sourceSha256":"a"*64,"sampleRate":48000,"channels":2,
                "sampleCount":240000,"durationSeconds":5.0,"codec":"pcm_s24le","lossless":True,
                "runtimeReceiptId":"probe-source",
            }
            output_metrics={
                "voicedFraction":0.70,"medianF0Hz":221.0,"f0SpreadCents":120.0,
                "spectralCentroidHz":2450.0,"rmsDb":-18.5,"harmonicity":0.66,
            }
            source_metrics={
                "voicedFraction":0.72,"medianF0Hz":220.0,"f0SpreadCents":115.0,
                "spectralCentroidHz":2400.0,"rmsDb":-18.0,"harmonicity":0.68,
            }
            captured={}
            def fake_probe(path,artifact_id,digest):
                if Path(path).name=="output.wav":
                    return {
                        "sourceArtifactId":artifact_id,"sourceSha256":digest,"sampleRate":48000,"channels":2,
                        "sampleCount":240000,"durationSeconds":5.0,"codec":"pcm_s24le","lossless":True,
                        "runtimeReceiptId":"probe-output",
                    }
                return source_probe
            def fake_run(args,**_kwargs):
                captured["args"]=args
                Path(args[-1]).write_bytes(b"restored-vocal")
                return Mock(returncode=0,stderr=b"")
            with patch.object(worker,"probe_path",side_effect=fake_probe), \
                 patch.object(worker,"_vocal_region_metrics",side_effect=[source_metrics,output_metrics]), \
                 patch.object(worker.shutil,"which",return_value="/usr/bin/ffmpeg"), \
                 patch.object(worker.subprocess,"run",side_effect=fake_run):
                receipt=worker.execute_vocal_restoration_path(
                    source,"vocals-1","a"*64,
                    "job-vocal-1","request-vocal-1","approval-vocal-1",
                    [{
                        "startMs":1000,"endMs":1400,"operation":"denoise",
                        "parameters":{"noiseFloorDb":-55},
                        "sourceResidualMix":0.08,"fadeMs":20,
                    }],
                    48000,2,config,
                )
            graph=captured["args"][captured["args"].index("-filter_complex")+1]
            self.assertIn("asplit=2",graph)
            self.assertIn("atrim=start=1.000000000:end=1.400000000",graph)
            self.assertIn("afftdn=nf=-55.000000",graph)
            self.assertIn("adelay=delays=1000.000:all=1",graph)
            self.assertIn("amix=inputs=2",graph)
            self.assertTrue(receipt["preservation"]["passed"])
            self.assertEqual(receipt["sourceArtifactId"],"vocals-1")
            self.assertEqual(receipt["segmentCount"],1)
            self.assertTrue(receipt["runtimeReceiptId"].startswith("music-vocal-restoration:"))

    def test_artifact_path_is_name_and_job_allow_listed(self):
        with tempfile.TemporaryDirectory() as td:
            config=worker.RestorationWorkerConfig(output_dir=Path(td))
            token="a"*24
            directory=Path(td)/f"reconstruct-{token}"
            directory.mkdir()
            output=directory/"output.wav"
            output.write_bytes(b"wav")
            self.assertEqual(worker.artifact_path(config,token,"output.wav"),output)
            self.assertIsNone(worker.artifact_path(config,token,"../../secret"))
            self.assertIsNone(worker.artifact_path(config,"bad","output.wav"))

    def test_source_staging_rejects_unadmitted_host_before_network(self):
        with tempfile.TemporaryDirectory() as td:
            with self.assertRaisesRegex(ValueError,"HOST_NOT_ADMITTED"):
                source_fetch.stage_verified_source(
                    "https://example.com/source.wav",
                    "a"*64,
                    Path(td)/"source.wav",
                    (".supabase.co",),
                )

if __name__=="__main__":
    unittest.main()
