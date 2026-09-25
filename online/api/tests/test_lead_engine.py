import unittest

from app.lead_engine import clean_domain, merge_evidence, score_search_result


class LeadEngineTests(unittest.TestCase):
    def test_clean_domain(self):
        self.assertEqual(clean_domain("https://www.example.com/path"), "example.com")
        self.assertEqual(clean_domain("example.org"), "example.org")

    def test_buyer_signal_scores_above_supplier_directory(self):
        buyer = {
            "title": "ABC Importers - Industrial Hardware Distributor Germany",
            "link": "https://abc-importers.example",
            "snippet": "German importer and distributor sourcing stainless steel hinges. Contact purchasing team.",
        }
        directory = {
            "title": "Stainless steel hinge manufacturers and suppliers",
            "link": "https://www.alibaba.com/example",
            "snippet": "Factory and leading supplier directory for stainless steel hinges.",
        }
        buyer_score, _, breakdown, priority = score_search_result(
            buyer,
            product_keyword="stainless steel hinges",
            buyer_type="importer distributor wholesaler",
            country="Germany",
        )
        directory_score, _, _, _ = score_search_result(
            directory,
            product_keyword="stainless steel hinges",
            buyer_type="importer distributor wholesaler",
            country="Germany",
        )
        self.assertGreater(buyer_score, directory_score)
        self.assertGreaterEqual(breakdown["buyer_fit"], 12)
        self.assertIn(priority, {"A", "B", "C", "D"})

    def test_score_is_explainable_and_bounded(self):
        score, reason, breakdown, priority = score_search_result(
            {
                "title": "Example wholesaler",
                "link": "https://example.com",
                "snippet": "Importer and wholesaler sourcing furniture hardware in France.",
            },
            product_keyword="furniture hardware",
            buyer_type="importer wholesaler",
            country="France",
        )
        self.assertGreaterEqual(score, 0)
        self.assertLessEqual(score, 100)
        self.assertTrue(reason)
        self.assertIn("product_match", breakdown)
        self.assertIn("buyer_fit", breakdown)
        self.assertIn(priority, {"A", "B", "C", "D"})

    def test_evidence_deduplicates_urls(self):
        merged = merge_evidence(
            "[]",
            [
                {"title": "A", "url": "https://example.com/a", "snippet": "one"},
                {"title": "A duplicate", "url": "https://example.com/a", "snippet": "two"},
                {"title": "B", "url": "https://example.com/b", "snippet": "three"},
            ],
        )
        self.assertEqual(merged.count("https://example.com/a"), 1)
        self.assertEqual(merged.count("https://example.com/b"), 1)


if __name__ == "__main__":
    unittest.main()
