"""
Agentic system for Vocalis AAC:
- Tool calling (Smart light control, Calendar event management, Memory/User Context editing)
- Pattern matching + LLM reasoning
- Persistent state management (Light state, Calendar events, Action log)
"""

import os
import json
import re
import uuid
import logging
from datetime import datetime, date, timedelta, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

logger = logging.getLogger("echo_flow_agent")
logger.setLevel(logging.INFO)

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
AGENT_STATE_FILE = DATA_DIR / "agent_state.json"

DEFAULT_STATE = {
    "light": {
        "state": "off",
        "color": "green",
        "brightness": 100,
        "last_updated": datetime.now(timezone.utc).isoformat()
    },
    "calendar_events": [
        {
            "id": "evt-default-01",
            "title": "Cita de revisión médica",
            "date": (date.today() + timedelta(days=1)).isoformat(),
            "time": "11:00",
            "description": "Consulta de logopedia y comunicación AAC",
            "source": "system",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ],
    "action_log": []
}


def _ensure_data_dir():
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def load_agent_state() -> Dict[str, Any]:
    _ensure_data_dir()
    if not AGENT_STATE_FILE.exists():
        save_agent_state(DEFAULT_STATE)
        return json.loads(json.dumps(DEFAULT_STATE))
    try:
        with open(AGENT_STATE_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            # Ensure essential keys exist
            if "light" not in data:
                data["light"] = DEFAULT_STATE["light"]
            if "calendar_events" not in data:
                data["calendar_events"] = DEFAULT_STATE["calendar_events"]
            if "action_log" not in data:
                data["action_log"] = []
            return data
    except Exception as e:
        logger.warning(f"Error loading agent state, resetting to default: {e}")
        return json.loads(json.dumps(DEFAULT_STATE))


def save_agent_state(state: Dict[str, Any]) -> None:
    _ensure_data_dir()
    try:
        with open(AGENT_STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(state, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error(f"Error saving agent state: {e}")


def log_agent_action(tool_name: str, parameters: Dict[str, Any], result: Dict[str, Any]) -> Dict[str, Any]:
    state = load_agent_state()
    action_entry = {
        "id": f"act-{uuid.uuid4().hex[:8]}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "tool": tool_name,
        "parameters": parameters,
        "result": result
    }
    state["action_log"] = [action_entry] + state.get("action_log", [])[:49]  # keep last 50
    save_agent_state(state)
    return action_entry


# ==============================================================================
# Tool Implementations
# ==============================================================================

def execute_control_light(
    state: str,
    color: Optional[str] = None,
    brightness: Optional[int] = 100
) -> Dict[str, Any]:
    """
    Controls smart light state and color.
    When turned on, defaults to green if unspecified (fulfills requirement).
    """
    agent_state = load_agent_state()
    current_light = agent_state.get("light", {})

    target_state = "on" if str(state).lower() in ["on", "true", "1", "encendido", "encender"] else "off"
    
    # If turned on and color not specified, default to green as requested by user
    if target_state == "on":
        target_color = color.lower().strip() if color else current_light.get("color", "green") or "green"
    else:
        target_color = color.lower().strip() if color else current_light.get("color", "green")

    # Map Spanish/English color names
    color_map = {
        "verde": "green",
        "green": "green",
        "blanco": "white",
        "white": "white",
        "calido": "warm white",
        "cálido": "warm white",
        "warm": "warm white",
        "azul": "blue",
        "blue": "blue",
        "rojo": "red",
        "red": "red",
        "amarillo": "yellow",
        "yellow": "yellow",
        "morado": "purple",
        "purple": "purple",
        "naranja": "orange",
        "orange": "orange"
    }
    target_color = color_map.get(target_color, target_color)

    updated_light = {
        "state": target_state,
        "color": target_color,
        "brightness": max(1, min(100, int(brightness or 100))),
        "last_updated": datetime.now(timezone.utc).isoformat()
    }
    agent_state["light"] = updated_light
    save_agent_state(agent_state)

    if target_state == "on":
        msg = f"Luz encendida en color {target_color}"
    else:
        msg = "Luz apagada"

    result = {
        "status": "success",
        "light": updated_light,
        "message": msg
    }
    log_agent_action("control_light", {"state": target_state, "color": target_color}, result)
    return result


def execute_add_calendar_event(
    title: str,
    date_str: Optional[str] = None,
    time_str: Optional[str] = None,
    description: Optional[str] = "",
    source: str = "agent"
) -> Dict[str, Any]:
    """Adds an event to the calendar."""
    agent_state = load_agent_state()
    
    # Parse date or default to tomorrow/today
    if not date_str:
        target_date = (date.today() + timedelta(days=1)).isoformat()
    elif date_str.lower() in ["hoy", "today"]:
        target_date = date.today().isoformat()
    elif date_str.lower() in ["mañana", "tomorrow"]:
        target_date = (date.today() + timedelta(days=1)).isoformat()
    elif date_str.lower() in ["pasado mañana"]:
        target_date = (date.today() + timedelta(days=2)).isoformat()
    else:
        # Check if already YYYY-MM-DD
        if re.match(r"^\d{4}-\d{2}-\d{2}$", date_str.strip()):
            target_date = date_str.strip()
        else:
            # Fallback
            target_date = (date.today() + timedelta(days=1)).isoformat()

    clean_time = time_str.strip() if time_str else "10:00"
    # Format time e.g. "10:00"
    if re.match(r"^\d{1,2}$", clean_time):
        clean_time = f"{int(clean_time):02d}:00"
    elif re.match(r"^\d{1,2}:\d{2}$", clean_time):
        parts = clean_time.split(":")
        clean_time = f"{int(parts[0]):02d}:{parts[1]}"

    new_event = {
        "id": f"evt-{uuid.uuid4().hex[:8]}",
        "title": title.strip() or "Nuevo evento",
        "date": target_date,
        "time": clean_time,
        "description": description.strip() if description else "",
        "source": source,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    events = agent_state.get("calendar_events", [])
    events.append(new_event)
    # Sort events by date and time
    events.sort(key=lambda x: (x.get("date", ""), x.get("time", "")))
    agent_state["calendar_events"] = events
    save_agent_state(agent_state)

    msg = f"Evento '{new_event['title']}' añadido para el {new_event['date']} a las {new_event['time']}"
    result = {
        "status": "success",
        "event": new_event,
        "calendar_events": events,
        "message": msg
    }
    log_agent_action("add_calendar_event", new_event, result)
    return result


def execute_delete_calendar_event(event_id: str) -> Dict[str, Any]:
    """Deletes an event from the calendar."""
    agent_state = load_agent_state()
    events = agent_state.get("calendar_events", [])
    initial_len = len(events)
    events = [e for e in events if e.get("id") != event_id]
    deleted = len(events) < initial_len
    agent_state["calendar_events"] = events
    save_agent_state(agent_state)

    result = {
        "status": "success" if deleted else "not_found",
        "deleted_id": event_id,
        "calendar_events": events,
        "message": f"Evento {event_id} eliminado" if deleted else "Evento no encontrado"
    }
    log_agent_action("delete_calendar_event", {"event_id": event_id}, result)
    return result


def execute_update_user_context(
    new_info: str,
    action: str = "append",
    current_context: Optional[str] = ""
) -> Dict[str, Any]:
    """
    Updates the LLM's memory/context about the user.
    The user can modify this context at any time.
    """
    clean_info = new_info.strip()
    if not clean_info:
        return {"status": "noop", "updated_context": current_context or "", "message": "No se aportó nueva información."}

    curr = (current_context or "").strip()
    if action == "replace":
        updated = clean_info
    else:
        # Avoid duplicate appending if the phrase is already present
        if clean_info.lower() in curr.lower():
            updated = curr
        elif curr:
            updated = f"{curr}\n• {clean_info}"
        else:
            updated = clean_info

    result = {
        "status": "success",
        "updated_context": updated,
        "added_note": clean_info,
        "message": f"Memoria sobre el usuario actualizada: {clean_info}"
    }
    log_agent_action("update_user_context", {"new_info": clean_info, "action": action}, result)
    return result


# ==============================================================================
# Intent Recognition & Tool Calling Engine
# ==============================================================================

def detect_and_execute_tools(
    text: str,
    user_context: Optional[str] = None,
    history: Optional[List[Dict[str, Any]]] = None
) -> Tuple[List[Dict[str, Any]], Optional[str]]:
    """
    Scans the message/turn for agent tool triggers (light control, calendar, user context memory).
    Executes matching tools and returns (executed_tools_list, updated_user_context_or_None).
    """
    executed_tools = []
    updated_context = None
    t = text.lower().strip()
    if not t:
        return executed_tools, updated_context

    # 1. Smart Light Control
    # Specific requirement: "a light that you can make green when it hears turn the light on"
    light_on_patterns = [
        r"\bturn\s+(?:the\s+)?light\s+on\b",
        r"\bturn\s+on\s+(?:the\s+)?light\b",
        r"\blight\s+on\b",
        r"\benciende\s+(?:la\s+)?luz\b",
        r"\bprende\s+(?:la\s+)?luz\b",
        r"\bencender\s+(?:la\s+)?luz\b",
        r"\bactivar?\s+(?:la\s+)?luz\b",
        r"\bpon\s+(?:la\s+)?luz\s+en\s+verde\b",
        r"\bpon\s+(?:la\s+)?luz\s+verde\b",
        r"\bluz\s+verde\b",
        r"\bmake\s+(?:the\s+)?light\s+green\b",
        r"\bgreen\s+light\b"
    ]
    light_off_patterns = [
        r"\bturn\s+(?:the\s+)?light\s+off\b",
        r"\bturn\s+off\s+(?:the\s+)?light\b",
        r"\blight\s+off\b",
        r"\bapaga\s+(?:la\s+)?luz\b",
        r"\bapagar\s+(?:la\s+)?luz\b",
        r"\bdesactivar?\s+(?:la\s+)?luz\b"
    ]

    has_light_on = any(re.search(pat, t) for pat in light_on_patterns)
    has_light_off = any(re.search(pat, t) for pat in light_off_patterns)

    if has_light_on:
        # Detect if another color was specified (e.g. blue, red, etc.), else default to green!
        color = "green"
        if re.search(r"\b(azul|blue)\b", t):
            color = "blue"
        elif re.search(r"\b(rojo|roja|red)\b", t):
            color = "red"
        elif re.search(r"\b(blanco|blanca|white|calido|cálido|warm)\b", t):
            color = "white"
        elif re.search(r"\b(amarillo|amarilla|yellow)\b", t):
            color = "yellow"
        elif re.search(r"\b(morado|morada|purple)\b", t):
            color = "purple"

        res = execute_control_light(state="on", color=color)
        executed_tools.append({
            "tool": "control_light",
            "parameters": {"state": "on", "color": color},
            "result": res
        })
    elif has_light_off:
        res = execute_control_light(state="off")
        executed_tools.append({
            "tool": "control_light",
            "parameters": {"state": "off"},
            "result": res
        })

    # 2. Calendar Event Management
    calendar_patterns = [
        r"\b(?:añade|agrega|crea|apunta|pon)\s+(?:un\s+|una\s+)?(?:evento|cita|reunión|recordatorio)\b",
        r"\b(?:add|create|schedule)\s+(?:an?\s+)?(?:event|meeting|appointment|reminder)\b",
        r"\b(?:cita\s+con\s+(?:el\s+)?médico|cita\s+con\s+(?:el\s+)?dentista|reunión\s+con)\b",
        r"\b(?:añade|add)\s+al\s+calendario\b",
        r"\badd\s+to\s+(?:my\s+)?calendar\b"
    ]
    if any(re.search(pat, t) for pat in calendar_patterns):
        # Extract title
        title = "Reunión"
        if "dentista" in t or "dentist" in t:
            title = "Cita con el dentista"
        elif "médico" in t or "doctor" in t:
            title = "Consulta médica"
        elif "reunión" in t or "meeting" in t:
            m = re.search(r"reunión\s+(?:con\s+([A-Za-zÁÉÍÓÚáéíóúñ]+)|de\s+([A-Za-zÁÉÍÓÚáéíóúñ]+))", t)
            if m:
                who = m.group(1) or m.group(2)
                title = f"Reunión con {who.capitalize()}"
            else:
                title = "Reunión programada"
        elif "cumpleaños" in t or "birthday" in t:
            title = "Cumpleaños"
        else:
            # Try to grab text after añade/add
            clean_cmd = re.sub(r"^(?:añade|agrega|apunta|add|schedule)\s+(?:un\s+|una\s+|al\s+calendario\s+|to\s+calendar\s+)?", "", t).strip()
            if clean_cmd:
                title = clean_cmd.split(" a las ")[0].split(" at ")[0].capitalize()[:40]

        # Extract date
        target_date = (date.today() + timedelta(days=1)).isoformat()
        if "hoy" in t or "today" in t:
            target_date = date.today().isoformat()
        elif "mañana" in t or "tomorrow" in t:
            target_date = (date.today() + timedelta(days=1)).isoformat()
        elif "pasado mañana" in t:
            target_date = (date.today() + timedelta(days=2)).isoformat()

        # Extract time
        target_time = "10:00"
        time_match = re.search(r"\b(?:a\s+las?|at)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm|h|horas)?\b", t)
        if time_match:
            hour = int(time_match.group(1))
            minute = time_match.group(2) or "00"
            ampm = (time_match.group(3) or "").lower()
            if ampm == "pm" and hour < 12:
                hour += 12
            target_time = f"{hour:02d}:{minute}"

        res = execute_add_calendar_event(title=title, date_str=target_date, time_str=target_time)
        executed_tools.append({
            "tool": "add_calendar_event",
            "parameters": {"title": title, "date": target_date, "time": target_time},
            "result": res
        })

    # 3. User Context & Memory Editing
    context_patterns = [
        r"\brecuerda\s+que\s+(.+)$",
        r"\bremember\s+that\s+(.+)$",
        r"\bapunta\s+que\s+(.+)$",
        r"\bguarda\s+en\s+mi\s+contexto\s+(?:que\s+)?(.+)$",
        r"\bsoy\s+(alérgico|celíaco|intolerante|vegetariano|vegano)\b",
        r"\bme\s+llamo\s+([A-Za-zÁÉÍÓÚáéíóúñ]+)\b",
        r"\bmy\s+name\s+is\s+([A-Za-z]+)\b"
    ]
    for pat in context_patterns:
        m = re.search(pat, t)
        if m:
            fact = ""
            if "alérgico" in t or "celíaco" in t or "intolerante" in t or "vegetariano" in t or "vegano" in t:
                fact = f"Dieta y preferencias: {t}"
            elif "me llamo" in t or "my name is" in t:
                name = m.group(1).capitalize()
                fact = f"Nombre del usuario: {name}"
            elif m.groups():
                fact = m.group(1).strip()
            
            if fact:
                res = execute_update_user_context(fact, action="append", current_context=user_context)
                updated_context = res.get("updated_context")
                executed_tools.append({
                    "tool": "update_user_context",
                    "parameters": {"content": fact, "action": "append"},
                    "result": res
                })
                break

    return executed_tools, updated_context
