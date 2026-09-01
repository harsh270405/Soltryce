from django.test import SimpleTestCase, override_settings

from app.knowledge_rag.services import InstitutionalRAGService


class RetrievalConfidenceTests(SimpleTestCase):
    @override_settings(RAG_MIN_SCORE=0.15)
    def test_mid_range_cosine_score_is_usable_evidence(self):
        service = InstitutionalRAGService.__new__(InstitutionalRAGService)

        self.assertFalse(service.evaluate_uncertainty('withdrawal deadline', [{'score': 0.42}]))

    @override_settings(RAG_MIN_SCORE=0.15)
    def test_very_low_score_is_uncertain(self):
        service = InstitutionalRAGService.__new__(InstitutionalRAGService)

        self.assertTrue(service.evaluate_uncertainty('withdrawal deadline', [{'score': 0.08}]))
