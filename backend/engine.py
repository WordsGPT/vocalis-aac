import os
import json
import re
import time
import logging
import requests
from typing import List, Optional, Dict, Any

logger = logging.getLogger("echo_flow_engine")
logging.basicConfig(level=logging.INFO)

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
DEFAULT_OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "gemma3:4b")
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
DEFAULT_GROQ_MODEL = "qwen/qwen3.8-27b"

HEURISTIC_TEMPLATES = [
    # Question patterns in Spanish (and English):
    {
        "patterns": [r"\bc[oó]mo est[aá]s\b", r"\bc[oó]mo va\b", r"\bc[oó]mo te sientes\b", r"\bhow are you\b", r"\bhow'?s it going\b"],
        "responses": [
            "¡Estoy bien, gracias por preguntar! ¿Y tú qué tal?",
            "No me quejo, llevando el día con calma.",
            "Un poco cansado hoy, pero todo bien."
        ]
    },
    {
        "patterns": [r"\bqu[eé] opinas\b", r"\bqu[eé] piensas\b", r"\btu opini[oó]n\b", r"\bwhat do you think\b"],
        "responses": [
            "¡Me parece una idea estupenda, adelante!",
            "Aún no estoy seguro, déjame pensarlo un momento.",
            "Tengo algunas dudas, ¿podríamos buscar otra opción?"
        ]
    },
    {
        "patterns": [r"\bcaf[eé]\b|\bt[eé]\b|\bbeber\b|\bbebida\b|\balmorzar\b|\bcomer\b|\bcomida\b|\bagua\b|\bcoffee\b|\bfood\b"],
        "responses": [
            "¡Suena delicioso, cuenta conmigo!",
            "Solo un poco de agua para mí, muchas gracias.",
            "Ahora mismo no tengo apetito, pero adelante tú."
        ]
    },
    {
        "patterns": [r"\blibre\b|\bdisponible\b|\btiempo\b|\bunirte\b|\bquedar\b|\bvamos\b|\bfree\b|\bmeet\b"],
        "responses": [
            "¡Sí, estoy libre! Me parece perfecto.",
            "¿A qué hora tenías pensado?",
            "Lo siento, ahora mismo estoy ocupado con algo."
        ]
    },
    {
        "patterns": [r"\bayuda\b|\bechar una mano\b|\bnecesitas algo\b|\bhelp\b|\bassist\b"],
        "responses": [
            "¡Sí por favor, te agradecería mucho la ayuda!",
            "Dame un momento y te voy diciendo.",
            "Estoy bien por ahora, ¡muchas gracias de todos modos!"
        ]
    },
    {
        "patterns": [r"\bd[oó]nde\b|\blugar\b|\bsitio\b|\bwhere\b"],
        "responses": [
            "Cualquier sitio que prefieras me viene bien.",
            "¿Podríamos buscar un lugar tranquilo?",
            "Prefiero quedarme por aquí si no te importa."
        ]
    },
    {
        "patterns": [r"\bgracias\b|\bmuchas gracias\b|\bagradezco\b|\bthanks\b|\bthank you\b"],
        "responses": [
            "¡De nada, no hay de qué!",
            "Un placer ayudarte siempre.",
            "¡Para eso estamos!"
        ]
    },
    {
        "patterns": [r"\bhola\b|\bbuenos d[ií]as\b|\bbuenas tardes\b|\bhello\b|\bhi\b"],
        "responses": [
            "¡Hola! Qué alegría verte, ¿cómo va todo?",
            "¡Hola! Dame un segundo que estoy usando mi comunicador.",
            "¡Buenas! Todo bien por aquí, cuéntame."
        ]
    }
]

DEFAULT_FALLBACK = [
    "¡Sí, totalmente de acuerdo!",
    "¿Podrías contarme un poco más sobre eso?",
    "No estoy muy seguro de eso, déjame pensarlo."
]

def generate_heuristic_responses(text: str) -> List[str]:
    """Pattern matching fallback when LLM is unavailable or offline."""
    lower = text.lower().strip()
    if not lower:
        return [
            "¡Hola! ¿Cómo estás?",
            "¡Qué alegría verte!",
            "Un momento, por favor, estoy escribiendo."
        ]
    
    for entry in HEURISTIC_TEMPLATES:
        for pat in entry["patterns"]:
            if re.search(pat, lower):
                return entry["responses"]
    
    # Generic question vs statement in Spanish
    if lower.endswith("?") or lower.startswith("¿"):
        return [
            "¡Sí, por supuesto!",
            "Tal vez, vamos a ver cómo se da.",
            "Creo que ahora mismo no."
        ]
    else:
        return [
            "¡Me parece estupendo!",
            "Qué interesante, cuéntame más.",
            "Entendido, muchas gracias por avisarme."
        ]

RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "affirmative": {"type": "string", "description": "Enthusiastic or friendly affirmative agreement response"},
        "thoughtful": {"type": "string", "description": "Inquiring question, neutral remark, or alternative option"},
        "decline": {"type": "string", "description": "Polite decline, boundary, or opposite preference"}
    },
    "required": ["affirmative", "thoughtful", "decline"]
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
    # Check if incomplete fragment (like "I" or "I want" or < 4 characters)
    if len(words) < 2 or len(t) < 4 or t.lower() in ["i", "i want", "i am", "yes", "no", "ok", "null", "none"]:
        return default
    return t

def clean_and_parse_responses(raw_text: str, default_fallback: List[str] = DEFAULT_FALLBACK) -> Optional[List[str]]:
    """Extracts 3 concise, complete response strings from LLM output."""
    if not raw_text:
        return None

    cleaned_raw = raw_text.replace('“', '"').replace('”', '"').replace('’', "'").replace('‘', "'")

    # 1. First, try finding a JSON object
    match_obj = re.search(r'\{.*?\}', cleaned_raw, re.DOTALL)
    if match_obj:
        try:
            data = json.loads(match_obj.group(0))
            if isinstance(data, dict):
                # Check for affirmative, thoughtful, decline keys
                if any(k in data for k in ["affirmative", "thoughtful", "decline"]):
                    aff = sanitize_sentence(data.get("affirmative"), default_fallback[0])
                    tht = sanitize_sentence(data.get("thoughtful"), default_fallback[1])
                    dec = sanitize_sentence(data.get("decline"), default_fallback[2])
                    return [aff, tht, dec]

                # Check other list keys like responses, suggestions, options
                for key in ["responses", "suggestions", "options", "answers", "choices"]:
                    if key in data and isinstance(data[key], list) and len(data[key]) > 0:
                        items = [sanitize_sentence(x, "") for x in data[key] if str(x).strip()]
                        valid = [x for x in items if x]
                        if len(valid) >= 3:
                            return valid[:3]

                # Plain dict values
                valid_vals = []
                for val in data.values():
                    if isinstance(val, str) and val.strip():
                        s = sanitize_sentence(val, "")
                        if s:
                            valid_vals.append(s)
                if len(valid_vals) >= 3:
                    return valid_vals[:3]
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
                while len(valid) < 3:
                    valid.append(default_fallback[len(valid)])
                return valid[:3]
        except Exception:
            pass

    # 3. Line-by-line fallback
    lines = cleaned_raw.strip().split("\n")
    cleaned_items = []
    for line in lines:
        cleaned = re.sub(r'^\s*(\d+[\.\)]|\-|\*|"[a-zA-Z]+":)\s*', '', line).strip().strip('"\'')
        s = sanitize_sentence(cleaned, "")
        if s and not s.startswith("{") and not s.startswith("[") and not s.endswith(":"):
            cleaned_items.append(s)

    if len(cleaned_items) >= 3:
        return cleaned_items[:3]
    elif len(cleaned_items) > 0:
        while len(cleaned_items) < 3:
            cleaned_items.append(default_fallback[len(cleaned_items)])
        return cleaned_items

    return None

def generate_responses_ollama(
    partner_text: str,
    history: Optional[List[Dict[str, str]]] = None,
    tone: str = "natural",
    model: str = DEFAULT_OLLAMA_MODEL
) -> Optional[List[str]]:
    """Calls local Ollama server with structured JSON schema for 3 complete AAC responses."""
    tone_instruction = {
        "casual": "Respuestas relajadas, informales y muy amigables.",
        "professional": "Respuestas educadas, formales y claras.",
        "concise": "Respuestas cortas y directas (3 a 6 palabras).",
        "warm": "Respuestas cálidas, entusiastas y empáticas."
    }.get(tone, "Respuestas naturales, conversacionales y directas.")

    prompt = f"""Eres un asistente comunicador aumentativo (AAC) para una persona que no puede hablar y se comunica en una conversación en vivo.
Alguien le acaba de decir:
"{partner_text}"

Genera exactamente 3 respuestas habladas naturales, completas, en primera persona y SIEMPRE EN ESPAÑOL que pueda pulsar para hablar en voz alta:
1. affirmative: acuerdo amigable, aceptación o entusiasmo
2. thoughtful: pregunta aclaratoria, comentario reflexivo o idea alternativa
3. decline: rechazo cortés, poner un límite o preferencia contraria

Tono: {tone_instruction}
Reglas:
- Habla directamente en primera persona ("yo", "me", "nosotros").
- Cada respuesta DEBE ser una frase completa y natural en ESPAÑOL (de 4 a 12 palabras).
- No generes fragmentos incompletos (NUNCA generes solo "Yo" o "Yo quiero").
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
                    "num_predict": 180
                }
            },
            timeout=8
        )
        if resp.status_code == 200:
            result = resp.json()
            raw = result.get("response", "")
            parsed = clean_and_parse_responses(raw)
            if parsed:
                return parsed
    except Exception as e:
        logger.warning(f"Ollama generation failed or timed out: {e}")
        
    return None

def generate_responses_gemini(
    partner_text: str,
    api_key: str,
    tone: str = "natural"
) -> Optional[List[str]]:
    """Calls Gemini REST API with user's key if configured."""
    if not api_key:
        return None
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    prompt = f"""Eres un comunicador aumentativo (AAC) para una persona que no puede hablar y está conversando en vivo.
Le acaban de decir:
"{partner_text}"

Sugiere exactamente 3 respuestas habladas en primera persona SIEMPRE EN ESPAÑOL:
1. (Positiva / De acuerdo)
2. (Pregunta / Alternativa / Neutral)
3. (Declinar cortésmente / Desacuerdo)

Responde ÚNICAMENTE con un array JSON válido de 3 cadenas de texto en español. Ejemplo: ["¡Sí, me parece genial!", "¿Podríamos hacerlo mañana?", "No podré en esta ocasión, lo siento."]"""

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
            parsed = clean_and_parse_responses(text)
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
    model: str = DEFAULT_GROQ_MODEL
) -> Optional[List[str]]:
    """Calls Groq API for ultra-fast (100ms) high quality LLM inference."""
    key = api_key or DEFAULT_GROQ_API_KEY
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
Basándote en el tema actual y contexto, sugiere exactamente 3 respuestas habladas naturales, completas, en primera persona y SIEMPRE EN ESPAÑOL en formato JSON:
{{
  "affirmative": "respuesta positiva o de acuerdo encajando en este momento exacto (4 a 12 palabras en español)",
  "thoughtful": "pregunta aclaratoria o alternativa encajando en este momento (4 a 12 palabras en español)",
  "decline": "rechazo educado o límite encajando en este momento (4 a 12 palabras en español)"
}}
Tono: {tone_instruction}
Reglas estrictas:
- Las 3 respuestas DEBEN estar en ESPAÑOL.
- Habla en primera persona ("yo", "me", "nosotros").
- Respuestas naturales y listas para ser reproducidas por voz artificial (TTS).
- Frases completas, no fragmentos."""

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
                parsed = clean_and_parse_responses(content)
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
    gemini_api_key: Optional[str] = None,
    groq_api_key: Optional[str] = None,
    preferred_engine: str = "groq"
) -> Dict[str, Any]:
    """
    Returns 3 smart responses using the best available engine.
    Order of preference:
    1. Groq (ultra fast 100ms inference with user's key)
    2. Ollama (local Gemma 3)
    3. Gemini (if key provided)
    4. Heuristic (0ms offline fallback)
    """
    partner_text = (partner_text or "").strip()
    if not partner_text:
        return {
            "suggestions": [
                "¡Hola! ¿Cómo estás hoy?",
                "Un momento, por favor, estoy usando mi comunicador.",
                "¡Qué alegría verte!"
            ],
            "engine": "preset"
        }

    # 1. Try Groq (Default / Primary)
    if preferred_engine in ["groq", "auto"] or (groq_api_key and preferred_engine != "ollama"):
        responses = generate_responses_groq(partner_text, groq_api_key, history, tone)
        if responses:
            return {"suggestions": responses, "engine": "groq"}

    # 2. Try Gemini if specifically requested
    if preferred_engine == "gemini" and gemini_api_key:
        responses = generate_responses_gemini(partner_text, gemini_api_key, tone)
        if responses:
            return {"suggestions": responses, "engine": "gemini"}

    # 3. Try Ollama (local gemma3)
    if preferred_engine in ["auto", "ollama"]:
        responses = generate_responses_ollama(partner_text, history, tone)
        if responses:
            return {"suggestions": responses, "engine": "ollama"}

    # 4. If Gemini key was provided in auto mode
    if preferred_engine == "auto" and gemini_api_key:
        responses = generate_responses_gemini(partner_text, gemini_api_key, tone)
        if responses:
            return {"suggestions": responses, "engine": "gemini"}

    # 5. Instant heuristic fallback
    responses = generate_heuristic_responses(partner_text)
    return {"suggestions": responses, "engine": "heuristic"}
