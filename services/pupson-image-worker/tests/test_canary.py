import io
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from PIL import Image
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from canary import assess_output, load_reference, refuse_nonlocal, run

def png(width=600,height=600,alpha=False):
    stream=io.BytesIO()
    Image.new("RGBA" if alpha else "RGB",(width,height),(127,93,75,0 if alpha else 255)).save(stream,"PNG")
    return stream.getvalue()

class CanaryTests(unittest.TestCase):
    def test_local_only(self):
        for url in ["https://example.com","http://example.com","http://127.0.0.1:8789/@evil","http://user:pass@localhost","file:///etc/passwd"]:
            with self.assertRaisesRegex(ValueError,"LOOPBACK"):
                refuse_nonlocal(url)
        refuse_nonlocal("http://127.0.0.1:8789")
    def test_reference_validation(self):
        with tempfile.TemporaryDirectory() as root:
            good=Path(root)/"pet.png";good.write_bytes(png())
            _,mime,digest=load_reference(good)
            self.assertEqual(mime,"image/png")
            self.assertEqual(len(digest),64)
            bad=Path(root)/"bad.png";bad.write_bytes(png(40,40))
            with self.assertRaisesRegex(ValueError,"RESOLUTION"):
                load_reference(bad)
    def test_output_review_does_not_claim_likeness(self):
        result=assess_output(png(alpha=True),transparent_expected=True)
        self.assertEqual((result["width"],result["height"]),(600,600))
        self.assertTrue(result["hasTransparency"])
        with self.assertRaisesRegex(ValueError,"TRANSPARENT"):
            assess_output(png(),transparent_expected=True)
    def test_execution_and_commercial_rights_are_explicit(self):
        args=SimpleNamespace(execute=False,commercial_license_attested=False)
        with self.assertRaisesRegex(ValueError,"EXPLICIT_EXECUTION"):
            run(args)
        args.execute=True
        with self.assertRaisesRegex(ValueError,"LICENSE"):
            run(args)

if __name__=="__main__":
    unittest.main()
