import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


class WorldCountryFaceParityContractTests(unittest.TestCase):
    def test_country_face_layer_is_local_factual_and_reuses_market_owner(self):
        source = (ROOT / 'web/world-country-face-parity-v1.js').read_text(encoding='utf-8')
        for marker in [
            'HUIDI_WORLD_BASEMAP', 'PARTS=289', 'wi-country-land', 'wiCountryFaces',
            '全球客户地图分布', '地图分析', '热力图', '数据分析',
            'HUIDIWorldCountryInteraction?.select', '/api/intel/world',
            '仅显示真实国家边界，不生成客户、询盘或热度数据',
        ]:
            self.assertIn(marker, source)
        self.assertIn("countryFaces:177", source)
        self.assertNotIn('cdn.jsdelivr.net', source)
        self.assertNotIn('natural-earth-vector@master', source)
        self.assertNotIn('/api/intel/world/country', source)
        self.assertNotIn('/send', source)
        self.assertNotIn('sequence-enrollments', source)
        result = subprocess.run(['node', '--check', str(ROOT / 'web/world-country-face-parity-v1.js')], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_real_community_entry_loads_face_layer_after_existing_world_owner(self):
        public_root = ROOT.parents[1] / 'public'
        loader = (public_root / 'huidi-community-online-intelligence-v2.js').read_text(encoding='utf-8')
        self.assertIn("worldFace:['world-country-face-parity-v1.js','HUIDIWorldCountryFaceParity']", loader)
        self.assertIn("await map.open();await load('worldFace')", loader)
        self.assertIn("HUIDIWorldCountryFaceParity?.refresh?.()", loader)
        result = subprocess.run(['node', '--check', str(public_root / 'huidi-community-online-intelligence-v2.js')], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == '__main__':
    unittest.main()
