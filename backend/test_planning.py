import unittest
from fastapi.testclient import TestClient
from backend.app import app
from backend.engine import generate_plan_continuations, generate_guided_storyboard

class PlanningTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_plan_continuations_heuristic(self):
        result = generate_plan_continuations(
            recipient="medico",
            pictograms=["Dolor", "Cabeza", "Noche"],
            count=5,
            grammatical_form="masculine"
        )
        self.assertIn("suggestions", result)
        self.assertGreaterEqual(len(result["suggestions"]), 3)
        self.assertEqual(result["recipient"], "medico")
        self.assertTrue(any("dolor" in s.lower() for s in result["suggestions"]))

    def test_plan_continuations_family(self):
        result = generate_plan_continuations(
            recipient="familia",
            pictograms=["Necesito", "Ayuda"],
            count=4,
            grammatical_form="feminine"
        )
        self.assertIn("suggestions", result)
        self.assertEqual(result["recipient"], "familia")
        self.assertGreaterEqual(len(result["suggestions"]), 2)

    def test_guided_storyboard_heuristic(self):
        result = generate_guided_storyboard(
            recipient="medico",
            goal="Molestias continuas en el estómago",
            grammatical_form="masculine"
        )
        self.assertIn("stages", result)
        stages = result["stages"]
        self.assertEqual(len(stages), 4)
        stage_ids = [s["id"] for s in stages]
        self.assertEqual(stage_ids, ["apertura", "nucleo", "seguimiento", "cierre"])
        for stage in stages:
            self.assertIn("options", stage)
            self.assertEqual(len(stage["options"]), 3)

    def test_api_plan_generate_continuations(self):
        res = self.client.post("/api/plan/generate", json={
            "type": "continuations",
            "recipient": "amigo",
            "pictograms": ["Pasear", "Ahora"],
            "count": 4
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("suggestions", data)
        self.assertGreaterEqual(len(data["suggestions"]), 2)

    def test_api_plan_generate_storyboard(self):
        res = self.client.post("/api/plan/generate", json={
            "type": "storyboard",
            "recipient": "tienda",
            "goal": "Devolver un jersey que me queda pequeño"
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("stages", data)
        self.assertEqual(len(data["stages"]), 4)

if __name__ == "__main__":
    unittest.main()
