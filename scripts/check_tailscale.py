#!/usr/bin/env python3
"""
Tailscale Connection & URL Collision Checker for Vocalis AAC.

Verifies that Tailscale is connected, checks whether the node's hostname
or public Funnel URL has been forced into a '-1' collision name by Tailscale,
and provides instructions to reclaim the canonical URL via the Tailscale admin console.
"""

import sys
import json
import re
import subprocess
import argparse

ADMIN_URL = "https://login.tailscale.com/admin/machines"


def get_tailscale_status():
    """Query `tailscale status --json`."""
    try:
        raw = subprocess.check_output(
            ["tailscale", "status", "--json"],
            stderr=subprocess.PIPE,
            text=True
        )
        return json.loads(raw)
    except FileNotFoundError:
        return {"error": "El comando 'tailscale' no está instalado en el sistema."}
    except subprocess.CalledProcessError as e:
        stderr = e.stderr if e.stderr else str(e)
        return {"error": f"tailscaled no está respondiendo: {stderr.strip()}"}
    except Exception as e:
        return {"error": f"Error al consultar Tailscale: {e}"}


def inspect_node_and_collision(data):
    """
    Analyzes the self node in the tailnet.
    Detects if Tailscale forced a numeric suffix like '-1', '-2' due to name collision.
    """
    self_node = data.get("Self", {})
    hostname = self_node.get("HostName", "")
    dnsname = self_node.get("DNSName", "").rstrip(".")
    online = self_node.get("Online", False)

    # Collision pattern: hostname ends with -<digits> or dnsname has -<digits> before the domain
    host_match = re.search(r"-(\d+)$", hostname)
    dns_match = re.search(r"-(\d+)\.[a-z0-9]+\.ts\.net$", dnsname)
    is_collision = bool(host_match or dns_match)

    base_hostname = re.sub(r"-\d+$", "", hostname)

    # Look for the peer occupying the canonical base name
    occupying_peer = None
    if is_collision:
        for peer in data.get("Peer", {}).values():
            p_host = peer.get("HostName", "")
            p_dns = peer.get("DNSName", "").rstrip(".")
            if p_host == base_hostname or p_dns.startswith(base_hostname + "."):
                occupying_peer = {
                    "hostname": p_host,
                    "dns": p_dns,
                    "online": peer.get("Online", False),
                    "last_seen": peer.get("LastSeen", ""),
                    "ips": peer.get("TailscaleIPs", []),
                }
                break

    return {
        "hostname": hostname,
        "dnsname": dnsname,
        "online": online,
        "is_collision": is_collision,
        "base_hostname": base_hostname,
        "occupying_peer": occupying_peer,
    }


def main():
    parser = argparse.ArgumentParser(description="Check Tailscale status and collision.")
    parser.add_argument("--allow-collision", "--force", action="store_true",
                        help="Allow running even if a '-1' collision name was forced.")
    parser.add_argument("--json", action="store_true", help="Output result as JSON.")
    parser.add_argument("--url-only", action="store_true", help="Print only the HTTPS URL.")
    args = parser.parse_args()

    data = get_tailscale_status()
    if "error" in data:
        if args.json:
            print(json.dumps({"ok": False, "error": data["error"]}))
        else:
            print(f"❌ ERROR: {data['error']}", file=sys.stderr)
        sys.exit(2)

    result = inspect_node_and_collision(data)

    if args.json:
        result["ok"] = not (result["is_collision"] and not args.allow_collision)
        print(json.dumps(result, indent=2))
        sys.exit(0 if result["ok"] else 1)

    if result["is_collision"] and not args.allow_collision:
        print("\n" + "=" * 76, file=sys.stderr)
        print("❌ ALERTA: LA URL DE TAILSCALE ESTÁ OCUPADA / DUPLICADA (-1 FORZADO)", file=sys.stderr)
        print("=" * 76, file=sys.stderr)
        print(f"Tailscale asignó a este contenedor un nombre con sufijo '-1':", file=sys.stderr)
        print(f"  • Nombre asignado: {result['hostname']}", file=sys.stderr)
        print(f"  • URL temporal:    https://{result['dnsname']}/", file=sys.stderr)
        print("", file=sys.stderr)
        print(f"La URL canónica normal ('{result['base_hostname']}') no se pudo registrar", file=sys.stderr)
        print("porque ya existe otra máquina en tu red con ese nombre.", file=sys.stderr)

        if result["occupying_peer"]:
            peer = result["occupying_peer"]
            status_str = "Conectada" if peer["online"] else "Desconectada / Offline"
            print(f"\n  • Máquina que está bloqueando la URL: {peer['dns']} ({status_str})", file=sys.stderr)

        print("\n👉 CÓMO DESBLOQUEAR LA URL NORMAL:", file=sys.stderr)
        print(f"  1. Abre la consola de Tailscale en tu navegador:", file=sys.stderr)
        print(f"     🔗 {ADMIN_URL}", file=sys.stderr)
        print(f"  2. Busca la máquina antigua/duplicada: '{result['base_hostname']}'", file=sys.stderr)
        print(f"  3. Haz clic en '...' (más opciones) -> 'Remove...' (o 'Delete')", file=sys.stderr)
        print(f"  4. Vuelve a reiniciar el servidor con:", file=sys.stderr)
        print(f"     vocalis-restart", file=sys.stderr)
        print("\n(Para ignorar este aviso y usar la URL con '-1', usa: vocalis-restart --force)", file=sys.stderr)
        print("=" * 76 + "\n", file=sys.stderr)
        sys.exit(1)

    if args.url_only:
        print(f"https://{result['dnsname']}")
    else:
        status_text = "En línea" if result["online"] else "Desconectado"
        suffix_warn = " (⚠️ Con sufijo '-1')" if result["is_collision"] else ""
        print(f"✅ Tailscale: {status_text} | URL: https://{result['dnsname']}/{suffix_warn}")

    sys.exit(0)


if __name__ == "__main__":
    main()
