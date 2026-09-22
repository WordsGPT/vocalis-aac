import os
import json
import re
import time
import logging
import requests
from pathlib import Path
from typing import List, Optional, Dict, Any

logger = logging.getLogger("echo_flow_engine")
logging.basicConfig(level=logging.INFO)

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
DEFAULT_OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "gemma3:4b")
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_API_KEY_FILE = Path(os.environ.get(
    "GROQ_API_KEY_FILE",
    Path(__file__).resolve().parents[2] / "qwen3-tts-runtime" / ".groq_api_key",
))
DEFAULT_GROQ_MODEL = "qwen/qwen3.8-27b"


def get_server_groq_api_key() -> str:
    key = os.environ.get("GROQ_API_KEY", "").strip()
    if key:
        return key
    try:
        return GROQ_API_KEY_FILE.read_text(encoding="utf-8").strip()
    except OSError:
        return ""

HEURISTIC_TEMPLATES = [
    # Question patterns in Spanish (and English):
    {
        "patterns": [r"\bc[oó]mo est[aá]s\b", r"\bc[oó]mo va\b", r"\bc[oó]mo te sientes\b", r"\bhow are you\b", r"\bhow'?s it going\b"],
        "responses": [
            "¡Estoy bien, gracias por preguntar! ¿Y tú qué tal?",
            "Todo tranquilo hoy, llevando el día con calma.",
            "Un poco cansado hoy, pero todo bien.",
            "¿Cómo ha ido tu día hasta ahora?",
            "Con ganas de hacer cosas interesantes hoy.",
            "Necesito descansar un poco, la verdad."
        ]
    },
    {
        "patterns": [r"\bqu[eé] opinas\b", r"\bqu[eé] piensas\b", r"\btu opini[oó]n\b", r"\bwhat do you think\b"],
        "responses": [
            "¡Me parece una idea estupenda, adelante!",
            "Me parece bien, cuenta con mi apoyo.",
            "¿Podrías darme un poco más de detalles?",
            "¿Y si consideramos otra alternativa diferente?",
            "Tengo algunas dudas, ¿podríamos revisarlo?",
            "Aún no estoy seguro, déjame pensarlo un momento."
        ]
    },
    {
        "patterns": [r"\bcaf[eé]\b|\bt[eé]\b|\bbeber\b|\bbebida\b|\balmorzar\b|\bcomer\b|\bcomida\b|\bagua\b|\bcoffee\b|\bfood\b"],
        "responses": [
            "¡Suena delicioso, cuenta conmigo!",
            "Me apetece mucho, vamos cuando quieras.",
            "¿Qué sitios tienes en mente para ir?",
            "¿Prefieres que vayamos a un lugar tranquilo?",
            "Ahora mismo no tengo apetito, pero adelante tú.",
            "Solo un poco de agua para mí, muchas gracias."
        ]
    },
    {
        "patterns": [r"\blibre\b|\bdisponible\b|\btiempo\b|\bunirte\b|\bquedar\b|\bvamos\b|\bfree\b|\bmeet\b"],
        "responses": [
            "¡Sí, estoy totalmente libre! Me parece perfecto.",
            "Tengo tiempo libre, me viene genial.",
            "¿A qué hora tenías pensado que nos veamos?",
            "¿Podríamos dejarlo para un poco más tarde?",
            "Lo siento, ahora mismo estoy ocupado con algo.",
            "Te aviso en un rato en cuanto termine esto."
        ]
    },
    {
        "patterns": [r"\bayuda\b|\bechar una mano\b|\bnecesitas algo\b|\bhelp\b|\bassist\b"],
        "responses": [
            "¡Sí por favor, te agradecería mucho la ayuda!",
            "Cualquier apoyo me vendría estupendo ahora.",
            "¿Qué necesitas exactamente que hagamos?",
            "¿Podemos hacerlo con calma paso a paso?",
            "Estoy bien por ahora, ¡muchas gracias de todos modos!",
            "Dame un momento y te voy indicando cómo ayudarme."
        ]
    },
    {
        "patterns": [r"\bd[oó]nde\b|\blugar\b|\bsitio\b|\bwhere\b"],
        "responses": [
            "Cualquier sitio que prefieras me viene bien.",
            "En casa o en un lugar tranquilo me gusta más.",
            "¿Dónde te viene mejor a ti quedar?",
            "¿Hay algún sitio cerca que conozcas?",
            "Prefiero quedarme por aquí si no te importa.",
            "Vamos a donde digas, me adapto a lo que prefieras."
        ]
    },
    {
        "patterns": [r"\bgracias\b|\bmuchas gracias\b|\bagradezco\b|\bthanks\b|\bthank you\b"],
        "responses": [
            "¡De nada, ha sido un auténtico placer!",
            "¡Muchas gracias a ti también por todo!",
            "¿Hay algo más en lo que pueda colaborar?",
            "¡Para eso estamos, cuenta conmigo!",
            "No te preocupes por nada, no tiene importancia.",
            "Me alegro mucho de haber sido de ayuda."
        ]
    },
    {
        "patterns": [r"\bhola\b|\bbuenos d[ií]as\b|\bbuenas tardes\b|\bhello\b|\bhi\b"],
        "responses": [
            "¡Hola! Qué alegría verte, ¿cómo va todo?",
            "¡Hola! Me alegro mucho de saludarte.",
            "¿Qué tal ha ido tu semana hasta ahora?",
            "¡Buenas! Dame un segundo que estoy usando mi comunicador.",
            "Aquí andamos, con calma y buen ánimo.",
            "¿De qué te gustaría que habláramos hoy?"
        ]
    }
]

DEFAULT_FALLBACK = [
    "¡Sí, totalmente de acuerdo!",
    "De acuerdo, me parece bien.",
    "¿Podrías contarme un poco más sobre eso?",
    "¿Y si buscamos otra opción diferente?",
    "No estoy muy seguro de eso, lo siento.",
    "Déjame pensarlo con calma un momento."
]

def generate_heuristic_responses(text: str, count: int = 6) -> List[str]:
    """Pattern matching fallback when LLM is unavailable or offline."""
    lower = text.lower().strip()
    if not lower:
        return [
            "¡Hola! ¿Cómo estás hoy?",
            "Un momento, por favor, estoy usando mi comunicador.",
            "¡Qué alegría verte por aquí!",
            "¿De qué te gustaría que habláramos?",
            "Estoy listo para conversar cuando quieras.",
            "Gracias por tu paciencia conmigo."
        ][:count]
    
    for entry in HEURISTIC_TEMPLATES:
        for pat in entry["patterns"]:
            if re.search(pat, lower):
                return entry["responses"][:count]
    
    # Generic question vs statement in Spanish
    if lower.endswith("?") or lower.startswith("¿"):
        return [
            "¡Sí, por supuesto, adelante!",
            "Me parece que sí, suena razonable.",
            "¿Podrías explicarme un poco más?",
            "¿Y si lo miramos desde otro punto de vista?",
            "Creo que en esta ocasión preferiría no hacerlo.",
            "No lo tengo claro todavía, dame un momento."
        ][:count]
    else:
        return [
            "¡Me parece estupendo!",
            "Totalmente de acuerdo contigo.",
            "¿Qué más ocurrió después?",
            "¿Tienes alguna otra idea sobre esto?",
            "Entendido, muchas gracias por avisarme.",
            "Me parece bien, tomemos nota de ello."
        ][:count]

RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "suggestions": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Lista de opciones habladas en primera persona en español"
        }
    },
    "required": ["suggestions"]
}

def sanitize_sentence(text: Any, default: str) -> str:
    """Cleans punctuation, html tags, and filters out incomplete fragments."""
    if not text or not isinstance(text, str):
        return default
    t = text.replace('“', '"').replace('”', '"').replace('’', "'").replace('‘', "'")
    t = re.sub(r'<[^>]+>', '', t)  # remove html tags
    t = re.sub(r'\[.*?\]', '', t)  # remove brackets / placeholders
    t = t.strip().strip('"\'').strip()
    words = t.split()
    # Check if incomplete fragment
    if len(words) < 2 or len(t) < 4 or t.lower() in ["i", "yo", "yo quiero", "i want", "i am", "yes", "no", "ok", "null", "none"]:
        return default
    return t

def clean_and_parse_responses(
    raw_text: str,
    default_fallback: List[str] = DEFAULT_FALLBACK,
    target_count: int = 6
) -> Optional[List[str]]:
    """Extracts up to target_count concise, complete response strings from LLM output."""
    if not raw_text:
        return None

    cleaned_raw = raw_text.replace('“', '"').replace('”', '"').replace('’', "'").replace('‘', "'")

    # 1. First, try finding a JSON object
    match_obj = re.search(r'\{.*?\}', cleaned_raw, re.DOTALL)
    if match_obj:
        try:
            data = json.loads(match_obj.group(0))
            if isinstance(data, dict):
                # Check list keys like suggestions, responses, options, choices
                for key in ["suggestions", "responses", "options", "answers", "choices"]:
                    if key in data and isinstance(data[key], list) and len(data[key]) > 0:
                        items = [sanitize_sentence(x, "") for x in data[key] if str(x).strip()]
                        valid = [x for x in items if x]
                        if len(valid) >= 2:
                            while len(valid) < target_count and len(valid) < len(default_fallback):
                                valid.append(default_fallback[len(valid)])
                            return valid[:target_count]

                # Plain dict values or named stances
                valid_vals = []
                for val in data.values():
                    if isinstance(val, str) and val.strip():
                        s = sanitize_sentence(val, "")
                        if s:
                            valid_vals.append(s)
                    elif isinstance(val, list):
                        for item in val:
                            s = sanitize_sentence(item, "")
                            if s:
                                valid_vals.append(s)
                if len(valid_vals) >= 2:
                    while len(valid_vals) < target_count and len(valid_vals) < len(default_fallback):
                        valid_vals.append(default_fallback[len(valid_vals)])
                    return valid_vals[:target_count]
        except Exception:
            pass

    # 2. Look for JSON array [ ... ]
    match_arr = re.search(r'\[.*?\]', cleaned_raw, re.DOTALL)
    if match_arr:
        try:
            data = json.loads(match_arr.group(0))
            if isinstance(data, list) and len(data) >= 2:
                items = [sanitize_sentence(x, "") for x in data if str(x).strip()]
                valid = [x for x in items if x]
                while len(valid) < target_count and len(valid) < len(default_fallback):
                    valid.append(default_fallback[len(valid)])
                return valid[:target_count]
        except Exception:
            pass

    # 3. Line-by-line fallback
    lines = cleaned_raw.strip().split("\n")
    cleaned_items = []
    for line in lines:
        cleaned = re.sub(r'^\s*(\d+[\.\)]|\-|\*|"[a-zA-Z0-9_\-]+":)\s*', '', line).strip().strip('"\'')
        s = sanitize_sentence(cleaned, "")
        if s and not s.startswith("{") and not s.startswith("[") and not s.endswith(":"):
            cleaned_items.append(s)

    if len(cleaned_items) >= 2:
        while len(cleaned_items) < target_count and len(cleaned_items) < len(default_fallback):
            cleaned_items.append(default_fallback[len(cleaned_items)])
        return cleaned_items[:target_count]

    return None

def generate_responses_ollama(
    partner_text: str,
    history: Optional[List[Dict[str, str]]] = None,
    tone: str = "natural",
    count: int = 6,
    model: str = DEFAULT_OLLAMA_MODEL
) -> Optional[List[str]]:
    """Calls local Ollama server with structured JSON schema for AAC responses."""
    tone_instruction = {
        "casual": "Respuestas relajadas, informales y muy amigables.",
        "professional": "Respuestas educadas, formales y claras.",
        "concise": "Respuestas cortas y directas (3 a 6 palabras).",
        "warm": "Respuestas cálidas, entusiastas y empáticas."
    }.get(tone, "Respuestas naturales, conversacionales y directas.")

    prompt = f"""Eres un asistente comunicador aumentativo (AAC) para una persona que no puede hablar y se comunica en una conversación en vivo.
Alguien le acaba de decir:
"{partner_text}"

Genera exactamente {count} respuestas habladas naturales, variadas, en primera persona y SIEMPRE EN ESPAÑOL que pueda pulsar para hablar en voz alta:
Incluye:
1. Acuerdo entusiasta o positivo
2. Acuerdo suave o neutral
3. Pregunta aclaratoria sobre el tema
4. Propuesta alternativa o sugerencia
5. Rechazo cortés o límite
6. Pedir tiempo para pensar o pausar

Tono: {tone_instruction}
Reglas:
- Habla directamente en primera persona ("yo", "me", "nosotros").
- Cada respuesta DEBE ser una frase completa y natural en ESPAÑOL (de 4 a 12 palabras).
- No generes fragmentos incompletos.
- NUNCA uses corchetes ni marcadores como [tema].
- Listas para ser reproducidas por un sintetizador de voz (TTS) de inmediato."""

    try:
        resp = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": model,
                "prompt": prompt,
                "stream": False,
                "format": RESPONSE_SCHEMA,
                "options": {
                    "temperature": 0.6,
                    "top_p": 0.9,
                    "num_predict": 240
                }
            },
            timeout=8
        )
        if resp.status_code == 200:
            result = resp.json()
            raw = result.get("response", "")
            parsed = clean_and_parse_responses(raw, target_count=count)
            if parsed:
                return parsed
    except Exception as e:
        logger.warning(f"Ollama generation failed or timed out: {e}")
        
    return None

def generate_responses_gemini(
    partner_text: str,
    api_key: str,
    tone: str = "natural",
    count: int = 6
) -> Optional[List[str]]:
    """Calls Gemini REST API with user's key if configured."""
    if not api_key:
        return None
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    prompt = f"""Eres un comunicador aumentativo (AAC) para una persona que no puede hablar y está conversando en vivo.
Le acaban de decir:
"{partner_text}"

Sugiere exactamente {count} respuestas habladas diversas en primera persona SIEMPRE EN ESPAÑOL:
- Acuerdo entusiasta
- Aceptación suave
- Pregunta o aclaración
- Alternativa o sugerencia
- Rechazo educado
- Pedir tiempo para pensar

Responde ÚNICAMENTE con un array JSON válido de {count} cadenas de texto en español. Ejemplo: ["¡Sí, me parece genial!", "De acuerdo, me parece bien.", "¿Podríamos hacerlo mañana?", "¿Y si probamos otra cosa?", "No podré en esta ocasión, lo siento.", "Déjame pensarlo un momento."][:count]"""

    try:
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0.7
            }
        }
        res = requests.post(url, json=payload, timeout=6)
        if res.status_code == 200:
            data = res.json()
            text = data["candidates"][0]["content"]["parts"][0]["text"]
            parsed = clean_and_parse_responses(text, target_count=count)
            if parsed:
                return parsed
    except Exception as e:
        logger.warning(f"Gemini API request failed: {e}")
        
    return None

def generate_responses_groq(
    partner_text: str,
    api_key: Optional[str] = None,
    history: Optional[List[Dict[str, str]]] = None,
    tone: str = "natural",
    count: int = 6,
    model: str = DEFAULT_GROQ_MODEL
) -> Optional[List[str]]:
    """Calls Groq API for ultra-fast (100ms) high quality LLM inference."""
    key = (api_key or "").strip() or get_server_groq_api_key()
    if not key:
        return None

    tone_instruction = {
        "casual": "Respuestas relajadas, informales y amigables.",
        "professional": "Respuestas educadas, formales y claras.",
        "concise": "Respuestas muy breves (3 a 6 palabras).",
        "warm": "Respuestas cálidas, empáticas y afectuosas."
    }.get(tone, "Respuestas naturales, conversacionales y directas.")

    system_prompt = f"""Eres un comunicador aumentativo (AAC) para una persona no verbal en una conversación real en vivo.
En el historial de mensajes:
- 'user' representa lo que dijo el interlocutor en voz alta.
- 'assistant' representa lo que la persona no verbal eligió previamente decir en voz alta.

El interlocutor acaba de decir el último mensaje.
Sugiere exactamente {count} respuestas que la persona no verbal podría decir ahora. Devuelve JSON con la clave "suggestions".
Tono: {tone_instruction}
Reglas estrictas:
- Las {count} respuestas DEBEN estar en ESPAÑOL.
- Cada opción debe responder directamente al significado del ÚLTIMO mensaje y conservar su tema concreto.
- No uses respuestas genéricas que funcionarían igual para cualquier conversación.
- Adapta las intenciones al mensaje: por ejemplo empatía ante malas noticias, respuesta directa ante preguntas, y curiosidad ante relatos.
- Ofrece opciones variadas y plausibles, pero no inventes datos personales, decisiones ni hechos que no aparecen en el contexto.
- Habla desde la perspectiva de la persona no verbal, normalmente en primera persona.
- Frases completas, naturales y listas para voz artificial, idealmente de 3 a 14 palabras.
- No incluyas etiquetas, explicaciones, numeración ni texto como "opción 1"."""

    messages = [{"role": "system", "content": system_prompt}]

    # Include recent dialogue history (both what was heard and what was spoken)
    if history:
        for msg in history[-8:]:
            sender = (msg.get("role") or msg.get("sender") or "").lower()
            content = (msg.get("content") or msg.get("text") or "").strip()
            if not content:
                continue
            
            # Partner is 'user', AAC mute user is 'assistant'
            if sender in ["partner", "them", "other", "speaker"]:
                messages.append({"role": "user", "content": content})
            else:
                messages.append({"role": "assistant", "content": content})

    # Append current partner statement if not already the last message
    if not (messages and messages[-1]["role"] == "user" and messages[-1]["content"] == partner_text):
        messages.append({
            "role": "user",
            "content": partner_text
        })

    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json"
    }

    # Attempt Groq twice with fallback models before giving up
    candidate_models = [model, "openai/gpt-oss-20b"]
    for attempt, curr_model in enumerate(candidate_models, start=1):
        payload = {
            "model": curr_model,
            "messages": messages,
            "response_format": {"type": "json_object"},
            "temperature": 0.6
        }

        try:
            res = requests.post(GROQ_API_URL, headers=headers, json=payload, timeout=6)
            if res.status_code == 200:
                data = res.json()
                content = data["choices"][0]["message"]["content"]
                parsed = clean_and_parse_responses(content, target_count=count)
                if parsed:
                    if attempt > 1:
                        logger.info(f"Groq succeeded on retry attempt {attempt} using {curr_model}")
                    return parsed
            else:
                logger.warning(f"Groq attempt {attempt} ({curr_model}) error: {res.status_code} {res.text[:100]}")
        except Exception as e:
            logger.warning(f"Groq attempt {attempt} ({curr_model}) failed: {e}")

        # Brief pause before second attempt
        if attempt < len(candidate_models):
            time.sleep(0.2)

    return None

def get_smart_suggestions(
    partner_text: str,
    history: Optional[List[Dict[str, str]]] = None,
    tone: str = "natural",
    count: int = 6,
    gemini_api_key: Optional[str] = None,
    groq_api_key: Optional[str] = None,
    preferred_engine: str = "groq"
) -> Dict[str, Any]:
    """
    Returns up to `count` (default 6) smart responses using the best available engine.
    Order of preference:
    1. Groq (ultra fast 100ms inference with user's key)
    2. Ollama (local Gemma 3)
    3. Gemini (if key provided)
    4. Heuristic (0ms offline fallback)
    """
    target_count = max(3, min(count, 8))
    partner_text = (partner_text or "").strip()
    if not partner_text:
        presets = [
            "¡Hola! ¿Cómo estás hoy?",
            "Estoy totalmente de acuerdo, me parece bien.",
            "¿Podrías contarme un poco más sobre eso?",
            "¿Y si buscamos otra opción diferente?",
            "No puedo en esta ocasión, muchas gracias.",
            "Dame un momento para pensarlo con calma."
        ]
        return {
            "suggestions": presets[:target_count],
            "engine": "preset"
        }

    # 1. Try Groq (Default / Primary)
    if preferred_engine in ["groq", "auto"] or (groq_api_key and preferred_engine != "ollama"):
        responses = generate_responses_groq(partner_text, groq_api_key, history, tone, count=target_count)
        if responses:
            return {"suggestions": responses, "engine": "groq"}

    # 2. Try Gemini if specifically requested
    if preferred_engine == "gemini" and gemini_api_key:
        responses = generate_responses_gemini(partner_text, gemini_api_key, tone, count=target_count)
        if responses:
            return {"suggestions": responses, "engine": "gemini"}

    # 3. Try Ollama (local gemma3)
    if preferred_engine in ["auto", "ollama"]:
        responses = generate_responses_ollama(partner_text, history, tone, count=target_count)
        if responses:
            return {"suggestions": responses, "engine": "ollama"}

    # 4. If Gemini key was provided in auto mode
    if preferred_engine == "auto" and gemini_api_key:
        responses = generate_responses_gemini(partner_text, gemini_api_key, tone, count=target_count)
        if responses:
            return {"suggestions": responses, "engine": "gemini"}

    # 5. Instant heuristic fallback
    responses = generate_heuristic_responses(partner_text, count=target_count)
    return {"suggestions": responses, "engine": "heuristic"}
