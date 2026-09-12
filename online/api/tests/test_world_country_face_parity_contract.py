import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


class WorldCountryFaceParityContractTests(unittest.TestCase):
    def test_country_face_layer_is_local_factual_and_reuses_market_owner(self):
        loader = (ROOT / 'web/world-country-face-parity-v1.js').read_text(encoding='utf-8')
        core = (ROOT / 'web/world-country-face-parity-core-v1.js').read_text(encoding='utf-8')
        interaction = (ROOT / 'web/world-country-interaction.js').read_text(encoding='utf-8')
        for marker in [
            'HUIDI_WORLD_BASEMAP', 'PARTS=289', 'wi-country-land', 'wiCountryFaces',
            '全球客户地图分布', '.wi-map-modes',
            'HUIDIWorldCountryInteraction?.select', '/api/intel/world',
            '仅显示真实国家边界，不生成客户、询盘或热度数据',
        ]:
            self.assertIn(marker, core)
        for marker in ['地图分析', '热力图', '数据分析']:
            self.assertIn(marker, interaction)
        self.assertIn("countryFaces:177", core)
        self.assertNotIn('cdn.jsdelivr.net', core + loader)
        self.assertNotIn('natural-earth-vector@master', core + loader)
        self.assertNotIn('/api/intel/world/country', core + loader)
        self.assertNotIn('/send', core + loader)
        self.assertNotIn('sequence-enrollments', core + loader)
        self.assertIn('world-country-face-parity-core-v1.js', loader)
        for marker in [
            '#wiCountrySearch', "e.key==='Enter'", '.wi-country-marker.selected',
            '.wi-country-land', 'syncBurst', 'HUIDIWorldCountryFaceSelectionSync',
        ]:
            self.assertIn(marker, loader)
        for name in ('world-country-face-parity-v1.js', 'world-country-face-parity-core-v1.js'):
            result = subprocess.run(['node', '--check', str(ROOT / 'web' / name)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)

    def test_real_community_entry_loads_face_layer_after_existing_world_owner(self):
        public_root = ROOT.parents[1] / 'public'
        entry = (public_root / 'huidi-community-online-intelligence-v2.js').read_text(encoding='utf-8')
        face_loader = (ROOT / 'web/world-country-face-parity-v1.js').read_text(encoding='utf-8')
        self.assertIn("worldFace:['world-country-face-parity-v1.js','HUIDIWorldCountryFaceSelectionSync']", entry)
        self.assertNotIn("worldFace:['world-country-face-parity-v1.js','HUIDIWorldCountryFaceParity']", entry)
        self.assertIn('window.HUIDIWorldCountryFaceSelectionSync=Object.freeze', face_loader)
        self.assertIn("await map.open();await load('worldFace')", entry)
        self.assertIn("HUIDIWorldCountryFaceParity?.refresh?.()", entry)
        result = subprocess.run(['node', '--check', str(public_root / 'huidi-community-online-intelligence-v2.js')], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == '__main__':
    unittest.main()
