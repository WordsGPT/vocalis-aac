#!/usr/bin/env python3
"""Unit tests for check_tailscale.py collision detection and status checking."""

import unittest
import sys
from pathlib import Path

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
from check_tailscale import inspect_node_and_collision


class TestTailscaleCheck(unittest.TestCase):
    def test_clean_node(self):
        data = {
            "Self": {
                "HostName": "jupyter-gonzalo-2emartinez-2eruizdearcaute",
                "DNSName": "jupyter-gonzalo-2emartinez-2eruizdearcaute.tailf4e249.ts.net.",
                "Online": True
            },
            "Peer": {}
        }
        res = inspect_node_and_collision(data)
        self.assertFalse(res["is_collision"])
        self.assertEqual(res["hostname"], "jupyter-gonzalo-2emartinez-2eruizdearcaute")
        self.assertEqual(res["dnsname"], "jupyter-gonzalo-2emartinez-2eruizdearcaute.tailf4e249.ts.net")
        self.assertTrue(res["online"])
        self.assertIsNone(res["occupying_peer"])

    def test_collision_hostname_suffix(self):
        data = {
            "Self": {
                "HostName": "jupyter-gonzalo-2emartinez-2eruizdearcaute-1",
                "DNSName": "jupyter-gonzalo-2emartinez-2eruizdearcaute-1.tailf4e249.ts.net.",
                "Online": True
            },
            "Peer": {
                "old-peer-key": {
                    "HostName": "jupyter-gonzalo-2emartinez-2eruizdearcaute",
                    "DNSName": "jupyter-gonzalo-2emartinez-2eruizdearcaute.tailf4e249.ts.net.",
                    "Online": False,
                    "LastSeen": "2026-10-06T10:00:00Z",
                    "TailscaleIPs": ["100.98.147.28"]
                }
            }
        }
        res = inspect_node_and_collision(data)
        self.assertTrue(res["is_collision"])
        self.assertEqual(res["base_hostname"], "jupyter-gonzalo-2emartinez-2eruizdearcaute")
        self.assertIsNotNone(res["occupying_peer"])
        self.assertEqual(res["occupying_peer"]["hostname"], "jupyter-gonzalo-2emartinez-2eruizdearcaute")
        self.assertFalse(res["occupying_peer"]["online"])

    def test_collision_dns_only_suffix(self):
        data = {
            "Self": {
                "HostName": "jupyter-gonzalo-2emartinez-2eruizdearcaute",
                "DNSName": "jupyter-gonzalo-2emartinez-2eruizdearcaute-2.tailf4e249.ts.net.",
                "Online": True
            },
            "Peer": {}
        }
        res = inspect_node_and_collision(data)
        self.assertTrue(res["is_collision"])


if __name__ == "__main__":
    unittest.main()
