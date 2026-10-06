import unittest
import shutil
import tempfile
from pathlib import Path
from backend import agent


class TestAgentSystem(unittest.TestCase):
    def setUp(self):
        # Use temporary directory for agent state
        self.test_dir = tempfile.mkdtemp()
        self.orig_data_dir = agent.DATA_DIR
        self.orig_state_file = agent.AGENT_STATE_FILE
        agent.DATA_DIR = Path(self.test_dir)
        agent.AGENT_STATE_FILE = Path(self.test_dir) / "agent_state.json"

    def tearDown(self):
        agent.DATA_DIR = self.orig_data_dir
        agent.AGENT_STATE_FILE = self.orig_state_file
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_control_light_turns_green_on(self):
        # Requirement: "make green when it hears turn the light on"
        res = agent.execute_control_light(state="on", color="green")
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["light"]["state"], "on")
        self.assertEqual(res["light"]["color"], "green")

        # Test turn off
        res_off = agent.execute_control_light(state="off")
        self.assertEqual(res_off["light"]["state"], "off")

    def test_detect_tools_turn_light_on_english(self):
        tools, _ = agent.detect_and_execute_tools("Please turn the light on right now")
        self.assertEqual(len(tools), 1)
        self.assertEqual(tools[0]["tool"], "control_light")
        self.assertEqual(tools[0]["result"]["light"]["state"], "on")
        self.assertEqual(tools[0]["result"]["light"]["color"], "green")

    def test_detect_tools_turn_light_on_spanish(self):
        tools, _ = agent.detect_and_execute_tools("Por favor enciende la luz")
        self.assertEqual(len(tools), 1)
        self.assertEqual(tools[0]["tool"], "control_light")
        self.assertEqual(tools[0]["result"]["light"]["state"], "on")
        self.assertEqual(tools[0]["result"]["light"]["color"], "green")

    def test_calendar_events_add_and_delete(self):
        # Requirement: "calendar that it can add events onto"
        tools, _ = agent.detect_and_execute_tools("Añade una cita con el dentista mañana a las 11:30")
        self.assertEqual(len(tools), 1)
        self.assertEqual(tools[0]["tool"], "add_calendar_event")
        event = tools[0]["result"]["event"]
        self.assertIn("dentista", event["title"].lower())
        self.assertEqual(event["time"], "11:30")

        # Verify event exists in state
        state = agent.load_agent_state()
        self.assertTrue(any(e["id"] == event["id"] for e in state["calendar_events"]))

        # Delete event
        del_res = agent.execute_delete_calendar_event(event["id"])
        self.assertEqual(del_res["status"], "success")
        state_after = agent.load_agent_state()
        self.assertFalse(any(e["id"] == event["id"] for e in state_after["calendar_events"]))

    def test_user_context_memory_editing(self):
        # Requirement: "llm can edit its own context about the user (which the user can modify)"
        initial_context = "El usuario se llama Ana."
        tools, updated = agent.detect_and_execute_tools(
            "Recuerda que soy alérgico a los frutos secos",
            user_context=initial_context
        )
        self.assertEqual(len(tools), 1)
        self.assertEqual(tools[0]["tool"], "update_user_context")
        self.assertIsNotNone(updated)
        self.assertIn("El usuario se llama Ana", updated)
        self.assertIn("alérgico a los frutos secos", updated)


if __name__ == "__main__":
    unittest.main()
