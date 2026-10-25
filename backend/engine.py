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

def grammatical_instruction(form: str) -> str:
    if form == "feminine":
        return "Al describirme usa el femenino singular (estoy cansada, estoy segura). No cambies el género de otras personas."
    return "Al describirme usa el masculino singular (estoy cansado, estoy seguro). No cambies el género de otras personas."


def personal_form(text: str, form: str) -> str:
    if form != "feminine":
        return text
    adjectives = "contento|enfadado|nervioso|tranquilo|sorprendido|aburrido|preocupado|emocionado|solo|cansado|mareado|seguro|ocupado|listo"
    return re.sub(
        rf"(\b(?:estoy|me siento|no estoy|aún no estoy|^un poco)\s+(?:(?:muy|totalmente|un poco)\s+)?)({adjectives})\b",
        lambda match: match[1] + match[2][:-1] + "a", text, flags=re.IGNORECASE,
    )


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

def generate_heuristic_responses(text: str, count: int = 6, mode: str = "reply") -> List[str]:
    """Pattern matching fallback when LLM is unavailable or offline."""
    if mode == "speak":
        return [
            "Tengo una idea sobre eso que podríamos probar.",
            "Quería decirte lo que opino sobre este tema.",
            "¿Y si lo enfocamos de otra manera totalmente distinta?",
            "A mí me gustaría mucho que hiciéramos un plan con eso.",
            "Cambiando un poco de rumbo, quería comentarte algo.",
            "¿Qué te parecería si tomamos la iniciativa nosotros?"
        ][:count]
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
    target_count: int = 6,
    return_dict: bool = False
) -> Any:
    """Extracts up to target_count concise, complete response strings from LLM output.
    If return_dict is True, returns {'suggestions': [...], 'direct_yes': str, 'direct_no': str}."""
    if not raw_text:
        return None

    cleaned_raw = raw_text.replace('“', '"').replace('”', '"').replace('’', "'").replace('‘', "'")
    direct_yes = None
    direct_no = None

    # 1. First, try finding a JSON object
    match_obj = re.search(r'\{.*?\}', cleaned_raw, re.DOTALL)
    if match_obj:
        try:
            data = json.loads(match_obj.group(0))
            if isinstance(data, dict):
                if "direct_yes" in data and isinstance(data["direct_yes"], str) and data["direct_yes"].strip():
                    direct_yes = data["direct_yes"].strip().strip('"\'')
                if "direct_no" in data and isinstance(data["direct_no"], str) and data["direct_no"].strip():
                    direct_no = data["direct_no"].strip().strip('"\'')

                # Check list keys like suggestions, responses, options, choices
                for key in ["suggestions", "responses", "options", "answers", "choices"]:
                    if key in data and isinstance(data[key], list) and len(data[key]) > 0:
                        items = [sanitize_sentence(x, "") for x in data[key] if str(x).strip()]
                        valid = [x for x in items if x]
                        if len(valid) >= 2:
                            while len(valid) < target_count and len(valid) < len(default_fallback):
                                valid.append(default_fallback[len(valid)])
                            res_list = valid[:target_count]
                            if return_dict:
                                return {"suggestions": res_list, "direct_yes": direct_yes, "direct_no": direct_no}
                            return res_list

                # Plain dict values or named stances
                valid_vals = []
                for k, val in data.items():
                    if k in ["direct_yes", "direct_no", "topics", "should_suggest", "reason"]:
                        continue
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
                    res_list = valid_vals[:target_count]
                    if return_dict:
                        return {"suggestions": res_list, "direct_yes": direct_yes, "direct_no": direct_no}
                    return res_list
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
                res_list = valid[:target_count]
                if return_dict:
                    return {"suggestions": res_list, "direct_yes": direct_yes, "direct_no": direct_no}
                return res_list
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
        res_list = cleaned_items[:target_count]
        if return_dict:
            return {"suggestions": res_list, "direct_yes": direct_yes, "direct_no": direct_no}
        return res_list

    return None

def generate_responses_ollama(
    partner_text: str,
    history: Optional[List[Dict[str, str]]] = None,
    tone: str = "natural",
    count: int = 6,
    model: str = DEFAULT_OLLAMA_MODEL,
    grammatical_form: str = "masculine"
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

Genera exactamente {count} respuestas habladas naturales, variadas, en primera persona y SIEMPRE EN ESPAÑOL que pueda pulsar para hablar en voz alta.
Adapta las intenciones con sentido común según lo escuchado:
- Si es una pregunta abierta o de datos: responde directamente con el dato, devuelve la pregunta amablemente, o añade un detalle (NUNCA fuerces "sí" o "no").
- Si es una elección: ofrece una opción, la otra o una alternativa.
- Si es una invitación o propuesta: aceptación, condición/matiz, declinación educada o alternativa.
- Si es una anécdota u opinión: empatía, apoyo, curiosidad por saber más o validación.

Tono: {tone_instruction}
{grammatical_instruction(grammatical_form)}
Reglas:
- Habla directamente en primera persona ("yo", "me", "nosotros").
- Cada respuesta DEBE ser una frase completa y natural en ESPAÑOL.
- Prohibido repetir opciones redundantes.
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
    count: int = 6,
    grammatical_form: str = "masculine",
    mode: str = "reply",
    user_context: Optional[str] = None,
    focus_topic: Optional[str] = None,
    topic_context: Optional[str] = None
) -> Optional[List[str]]:
    """Calls Gemini REST API with user's key if configured."""
    if not api_key:
        return None
    
    url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent"
    topic_extra = f"\nEnfoque en volver al tema '{focus_topic}'. Contexto previo: {topic_context}" if focus_topic else ""
    user_extra = f"\nInformación del usuario: {user_context}" if user_context else ""
    if mode == "speak":
        guidance = f"""MODO HABLAR / DIRIGIR LA CONVERSACIÓN:
No te limites a contestar de forma reactiva a lo que dijeron. Ofrece {count} opciones para que la persona no verbal TOME LA INICIATIVA, dirija la conversación, proponga nuevos planes o ideas, y diga lo que piensa o quiere hacer basándose en lo hablado.{topic_extra}{user_extra}"""
    else:
        guidance = f"""Adapta las opciones inteligentemente a lo que se ha dicho:
- Si es pregunta abierta o de datos: responde directamente, devuelve la pregunta o añade un matiz (sin forzar "sí" o "no").
- Si es una elección: elige una opción, la otra o una alternativa.
- Si es una propuesta: acepta, matiza, declina educadamente o propón otro plan.
- Si es una anécdota o noticia: muestra empatía, apoyo o curiosidad.{topic_extra}{user_extra}"""

    prompt = f"""Eres un comunicador aumentativo (AAC) para una persona que no puede hablar y está conversando en vivo.
Le acaban de decir:
"{partner_text}"

{grammatical_instruction(grammatical_form)}
Sugiere exactamente {count} respuestas habladas diversas en primera persona SIEMPRE EN ESPAÑOL.
{guidance}

Responde ÚNICAMENTE con un array JSON válido de {count} cadenas de texto en español."""

    try:
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0.7
            }
        }
        res = requests.post(url, json=payload, headers={"x-goog-api-key": api_key}, timeout=20)
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
    model: str = DEFAULT_GROQ_MODEL,
    grammatical_form: str = "masculine",
    user_context: Optional[str] = None,
    mode: str = "reply",
    focus_topic: Optional[str] = None,
    topic_context: Optional[str] = None
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

    user_info = ""
    if user_context and user_context.strip():
        user_info = f"""
INFORMACIÓN Y DATOS PERSONALES DEL USUARIO (úsalos para responder fielmente a preguntas sobre su nombre, vida, gustos o circunstancias):
\"\"\"
{user_context.strip()[:2000]}
\"\"\"
"""
    topic_extra = ""
    if focus_topic and focus_topic.strip():
        topic_extra = f"\nENFOQUE EN RETOMAR EL TEMA: '{focus_topic}'. Contexto previo: {topic_context or 'Mencionado antes en la conversación.'}\n"

    if mode == "speak":
        guidance = f"""MODO ACTIVO: MODO HABLAR / DIRIGIR LA CONVERSACIÓN.
El usuario ha activado el MODO HABLAR. En este modo, las sugerencias NO DEBEN SER REACTIVAS NI LIMITARSE A RESPONDER pasivamente a lo que acaban de decir.
En su lugar, deben DIRIGIR LA CONVERSACIÓN y proponer lo que el usuario QUIERE DECIR, PROPONER O CONTAR, basándose en lo hablado pero tomando la iniciativa y llevando el rumbo del diálogo:
1. DIRIGIR Y PROPONER: Plantear nuevos temas, planes o siguientes pasos relacionados con lo hablado.
2. EXPRESAR LO QUE QUIERE DECIR: Compartir opiniones propias, convicciones, anécdotas o deseos de forma asertiva.
3. PREGUNTAS DE LIDERAZGO: Preguntas que orientan al interlocutor hacia una acción o nuevo rumbo.
4. CONECTAR CON LO DICHO: Construye sobre lo escuchado sin ser pasivo.{topic_extra}"""
    else:
        guidance = f"""ADAPTACIÓN INTELIGENTE SEGÚN EL TIPO DE MENSAJE:
1. PREGUNTAS ABIERTAS O DE DATOS (ej. "¿Cómo te llamas?", "¿Dónde vives?", "¿Qué tal estás?", "¿Qué hora es?", "¿A qué te dedicas?"):
   - Ofrece respuestas directas y completas (usando fielmente la información personal del usuario si aplica).
   - Ofrece variedad de intenciones útiles: respuesta directa cordial, respuesta que devuelve la pregunta amablemente ("¿Y tú cómo te llamas?"), añadir un detalle relacionado agradable, o preguntar un detalle afín.
   - NUNCA fuerces "Sí", "No" ni respuestas defensivas o cortantes como "No te lo digo".
2. PREGUNTAS DE ELECCIÓN (ej. "¿Pizza o hamburguesa?", "¿Cine o paseo?"):
   - Ofrece elegir una opción, elegir la otra, proponer una alternativa diferente, o dejar que elija la otra persona ("Lo que tú prefieras", "Me da igual, tú mandas").
3. PROPUESTAS, INVITACIONES O PREGUNTAS DE SÍ/NO (ej. "¿Quieres un café?", "¿Vamos al parque?", "¿Tienes hambre?"):
   - Ofrece aceptación positiva, aceptación con condición o matiz ("sí, pero solo un rato"), declinación educada, o contrapropuesta.
4. HISTORIAS, OPINIONES O NOTICIAS (ej. "He tenido un mal día", "Mira lo que compré", "Mi abuela está enferma"):
   - Ofrece empatía, apoyo, curiosidad por saber más, validación o una opinión/experiencia afín.
5. SALUDOS O CORDIALIDAD (ej. "¡Hola!", "¿Qué tal?", "Muchas gracias"):
   - Ofrece saludos cálidos, devoluciones de saludo, agradecimiento o comentarios casuales según el estado de ánimo.{topic_extra}"""

    system_prompt = f"""Eres el sistema de sugerencias de un comunicador aumentativo (AAC) para una persona no verbal en una conversación real en vivo.
En el historial de mensajes:
- 'user' representa lo que dijo el interlocutor en voz alta.
- 'assistant' representa lo que la persona no verbal eligió previamente decir en voz alta.
{user_info}
El interlocutor acaba de decir el último mensaje.
La interfaz del comunicador cuenta con dos botones fijos dedicados para respuestas directas de Sí y No: 'direct_yes' y 'direct_no'.
Por tanto, las {count} opciones principales en 'suggestions' NO deben ser un simple sí o no; deben ser más ricas, variadas y diversas (matices, contrapropuestas, preguntas de vuelta, comentarios o alternativas).

{guidance}

Tono: {tone_instruction}
{grammatical_instruction(grammatical_form)}
Reglas estrictas:
- Genera exactamente {count} respuestas en 'suggestions' en primera persona, en ESPAÑOL natural y fluido.
- Ninguna de las opciones en 'suggestions' debe ser un simple sí o no.
- Genera 'direct_yes' con una respuesta afirmativa directa contextualizada a lo que acaban de decir (ej: "Sí, me parece perfecto", "Sí, me encantaría").
- Genera 'direct_no' con una respuesta negativa directa contextualizada a lo que acaban de decir (ej: "No, prefiero no hacerlo ahora", "No, no me apetece, gracias").
- Cada opción en 'suggestions' debe tener una postura conversacional distinta (afinidad, matiz, curiosidad, alternativa o empatía), adaptada con sentido común al tema.
- Si la pregunta se refiere a la identidad, nombre, gustos o datos del usuario, utiliza SIEMPRE la INFORMACIÓN PERSONAL de arriba de forma exacta.
- Frases completas, naturales y listas para voz artificial.
- Prohibido repetir la misma idea con palabras similares o generar múltiples preguntas redundantes.
- No incluyas etiquetas, explicaciones, numeración ni texto como "opción 1".
Devuelve exclusivamente un objeto JSON con las claves "direct_yes", "direct_no" y "suggestions"."""

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
                label = msg.get("speaker_label") or "Interlocutor"
                messages.append({"role": "user", "content": f"{label}: {content}"})
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
                parsed = clean_and_parse_responses(content, target_count=count, return_dict=True)
                if parsed and parsed.get("suggestions"):
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
    preferred_engine: str = "groq",
    grammatical_form: str = "masculine",
    user_context: Optional[str] = None,
    mode: str = "reply",
    focus_topic: Optional[str] = None,
    topic_context: Optional[str] = None
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
        if mode == "speak":
            presets = [
                "Tengo una propuesta sobre esto que podríamos probar.",
                "Quería decirte lo que opino sobre este tema.",
                "¿Y si lo enfocamos de otra manera totalmente distinta?",
                "A mí me gustaría mucho que hiciéramos un plan con eso.",
                "Cambiando un poco de rumbo, quería comentarte algo.",
                "¿Qué te parecería si tomamos la iniciativa nosotros?"
            ]
        else:
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
            "direct_yes": "Sí, me parece bien.",
            "direct_no": "No, ahora mismo no.",
            "engine": "preset"
        }

    # 1. Try Groq (Default / Primary)
    if preferred_engine in ["groq", "auto"]:
        res_data = generate_responses_groq(
            partner_text, groq_api_key, history, tone,
            count=target_count, grammatical_form=grammatical_form,
            user_context=user_context, mode=mode,
            focus_topic=focus_topic, topic_context=topic_context
        )
        if res_data:
            suggestions = [personal_form(text, grammatical_form) for text in res_data.get("suggestions", [])]
            direct_yes = personal_form(res_data.get("direct_yes") or "Sí, me parece bien.", grammatical_form)
            direct_no = personal_form(res_data.get("direct_no") or "No, ahora mismo no.", grammatical_form)
            return {
                "suggestions": suggestions,
                "direct_yes": direct_yes,
                "direct_no": direct_no,
                "engine": "groq"
            }

    # 2. Try Gemini if specifically requested
    if preferred_engine == "gemini" and gemini_api_key:
        responses = generate_responses_gemini(
            partner_text, gemini_api_key, tone,
            count=target_count, grammatical_form=grammatical_form,
            mode=mode, user_context=user_context,
            focus_topic=focus_topic, topic_context=topic_context
        )
        if responses:
            return {
                "suggestions": [personal_form(text, grammatical_form) for text in responses],
                "direct_yes": "Sí, por supuesto.",
                "direct_no": "No, gracias.",
                "engine": "gemini"
            }

    # 3. Try Ollama (local gemma3)
    if preferred_engine in ["auto", "ollama"]:
        responses = generate_responses_ollama(partner_text, history, tone, count=target_count, grammatical_form=grammatical_form)
        if responses:
            return {
                "suggestions": [personal_form(text, grammatical_form) for text in responses],
                "direct_yes": "Sí, por supuesto.",
                "direct_no": "No, gracias.",
                "engine": "ollama"
            }

    # 4. If Gemini key was provided in auto mode
    if preferred_engine == "auto" and gemini_api_key:
        responses = generate_responses_gemini(
            partner_text, gemini_api_key, tone,
            count=target_count, grammatical_form=grammatical_form,
            mode=mode, user_context=user_context,
            focus_topic=focus_topic, topic_context=topic_context
        )
        if responses:
            return {
                "suggestions": [personal_form(text, grammatical_form) for text in responses],
                "direct_yes": "Sí, por supuesto.",
                "direct_no": "No, gracias.",
                "engine": "gemini"
            }

    # 5. Instant heuristic fallback
    responses = generate_heuristic_responses(partner_text, count=target_count, mode=mode)
    return {
        "suggestions": [personal_form(text, grammatical_form) for text in responses],
        "direct_yes": "Sí, por supuesto.",
        "direct_no": "No, gracias.",
        "engine": "heuristic"
    }


RECIPIENT_DESCRIPTIONS = {
    "medico": "Médico, enfermero/a o personal sanitario en una consulta clínica.",
    "familia": "Miembro cercano de la familia, pareja o conviviente en casa.",
    "amigo": "Amigo/a o compañero/a en un ambiente social y distendido.",
    "tienda": "Dependiente, camarero/a o personal de atención al público en comercio o servicios.",
    "trabajo": "Profesor/a, tutor/a, jefe o compañero de trabajo en un entorno formal.",
    "general": "Cualquier persona en una conversación cotidiana."
}


def generate_plan_continuations(
    recipient: str = "general",
    pictograms: Optional[List[str]] = None,
    tone: str = "natural",
    grammatical_form: str = "masculine",
    user_context: Optional[str] = None,
    count: int = 5,
    groq_api_key: Optional[str] = None,
) -> Dict[str, Any]:
    """Generates natural sentence continuations expanding selected pictograms for a specific recipient."""
    recipient_key = (recipient or "general").lower()
    recipient_desc = RECIPIENT_DESCRIPTIONS.get(recipient_key, RECIPIENT_DESCRIPTIONS["general"])
    picto_list = [p.strip() for p in (pictograms or []) if p and p.strip()]
    picto_str = ", ".join(picto_list) if picto_list else "conversación general"

    target_count = max(3, min(count, 8))
    key = (groq_api_key or "").strip() or get_server_groq_api_key()

    if key:
        user_info = ""
        if user_context and user_context.strip():
            user_info = f"\nDATOS PERSONALES DEL USUARIO:\n\"\"\"\n{user_context.strip()[:1500]}\n\"\"\"\n"

        prompt = f"""Eres el motor de planificación anticipada de un comunicador aumentativo (AAC) para una persona con dificultades motoras o del habla.
El usuario no puede escribir fácilmente con teclado, por lo que planifica lo que quiere decir seleccionando:
- Destinatario: {recipient_desc}
- Ideas / conceptos elegidos mediante pictogramas: {picto_str}
{user_info}
Genera {target_count} frases completas, en primera persona, listas para ser habladas con voz artificial.
Cada frase debe desarrollar de forma natural y respetuosa esas ideas en el contexto del destinatario.
{grammatical_instruction(grammatical_form)}
Tono: {tone}
Reglas:
- Frases completas, naturales, expresivas y en ESPAÑOL.
- Cada opción debe ofrecer un matiz o intención diferente (ej. pregunta, afirmación con detalle, petición de ayuda, propuesta).
- No uses numeración ni viñetas en los textos.
Devuelve EXCLUSIVAMENTE un objeto JSON: {{"suggestions": ["frase 1", "frase 2", ...]}}"""

        try:
            res = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={
                    "model": DEFAULT_GROQ_MODEL,
                    "messages": [{"role": "system", "content": prompt}],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.65,
                    "max_tokens": 600,
                },
                timeout=3.5,
            )
            if res.status_code == 200:
                data = res.json()
                raw = json.loads(data["choices"][0]["message"]["content"])
                suggestions = raw.get("suggestions", [])
                if isinstance(suggestions, list) and len(suggestions) > 0:
                    clean = [personal_form(str(s).strip(), grammatical_form) for s in suggestions if s][:target_count]
                    if clean:
                        return {"suggestions": clean, "engine": "groq", "recipient": recipient_key}
        except Exception as e:
            logger.warning(f"Groq plan continuations error: {e}")

    # Rich heuristic fallback
    heuristics = []
    has_dolor = any(w in picto_str.lower() for w in ["dolor", "mal", "cansado", "salud"])
    has_medicina = any(w in picto_str.lower() for w in ["medicina", "pastilla", "receta", "duda"])
    has_necesidad = any(w in picto_str.lower() for w in ["necesito", "quiero", "ayuda", "favor"])
    has_comida = any(w in picto_str.lower() for w in ["comida", "agua", "beber", "comer", "cena"])
    has_sentimiento = any(w in picto_str.lower() for w in ["contento", "preocupado", "nervioso", "triste", "miedo"])

    if recipient_key == "medico":
        if has_dolor:
            heuristics.extend([
                "Tengo dolor y molestias en esta zona desde hace unos días.",
                "El dolor aumenta por las noches y no me deja descansar bien.",
                "¿Podría comprobar de dónde puede venir este dolor?",
                "La medicación actual no parece aliviar la molestia.",
                "Quisiera saber qué prueba o tratamiento me recomienda hacer."
            ])
        elif has_medicina:
            heuristics.extend([
                "Quería consultar si puedo ajustar el horario o la dosis de la medicación.",
                "Creo que una de las pastillas me provoca algo de malestar.",
                "¿Podría renovar mi receta para el próximo mes?",
                "Tengo dudas sobre cómo tomar este tratamiento correctamente."
            ])
        else:
            heuristics.extend([
                f"Quería consultar sobre {picto_str} y saber su valoración.",
                "He preparado estas notas con mi comunicador para explicarle mi situación.",
                "Me gustaría saber qué pautas me aconseja seguir a partir de ahora.",
                "Tengo algunas preguntas sobre mi evolución y bienestar."
            ])
    elif recipient_key == "familia":
        if has_necesidad:
            heuristics.extend([
                "¿Podéis ayudarme con una cosa cuando tengáis un momento libre?",
                "Necesito descansar un poco tranquilo en casa, por favor.",
                "Quería hablar con vosotros sobre cómo organizar mejor las cosas hoy.",
                "Agradezco mucho vuestra paciencia y apoyo."
            ])
        elif has_comida:
            heuristics.extend([
                "Me apetece comer algo ligero y beber agua fresca.",
                "¿Qué tenemos planeado para la comida hoy?",
                "Me gustaría elegir lo que vamos a cenar juntos."
            ])
        else:
            heuristics.extend([
                f"Quería comentaros algo sobre {picto_str}.",
                "Me hace mucha ilusión pasar un rato tranquilo en familia.",
                "¿Podemos planear algo juntos para este fin de semana?",
                "Hoy me siento con ganas de charlar un poco con vosotros."
            ])
    elif recipient_key == "amigo":
        heuristics.extend([
            f"¡Hola! Quería contarte algo sobre {picto_str} que me pasó.",
            "¿Te apetece que quedemos un rato a tomar algo y charlar?",
            "Me apetecía mucho saber cómo te van las cosas últimamente.",
            "¡Qué buena idea! Me alegro mucho de hablar contigo hoy.",
            "Dame un segundo para preparar lo que quiero decirte."
        ])
    elif recipient_key == "tienda":
        heuristics.extend([
            f"Buenos días. Quisiera pedir información sobre {picto_str}.",
            "¿Podría decirme cuánto cuesta esto, por favor?",
            "¿Tiene otra talla o una opción diferente disponible?",
            "Voy a pagar con tarjeta, muchas gracias por su ayuda."
        ])
    elif recipient_key == "trabajo":
        heuristics.extend([
            f"Buenos días. He preparado estos puntos sobre {picto_str} para revisarlos.",
            "Quería consultar esta duda para coordinarme mejor con el equipo.",
            "Agradezco su atención y el tiempo dedicado a esta reunión.",
            "¿Podríamos acordar el siguiente paso para este proyecto?"
        ])
    else:
        heuristics.extend([
            f"Quiero comentar algo importante sobre {picto_str}.",
            "Uso este comunicador para hablar, gracias por tu paciencia.",
            "¿Podemos hablar de esto con calma un momento?",
            "Me parece una propuesta interesante y quiero participar.",
            "Tengo una pregunta que me gustaría hacerte."
        ])

    clean = [personal_form(h, grammatical_form) for h in heuristics][:target_count]
    return {"suggestions": clean, "engine": "heuristic", "recipient": recipient_key}


def generate_guided_storyboard(
    recipient: str = "general",
    goal: Optional[str] = None,
    tone: str = "natural",
    grammatical_form: str = "masculine",
    user_context: Optional[str] = None,
    groq_api_key: Optional[str] = None,
) -> Dict[str, Any]:
    """Generates a 4-stage conversational storyboard (Apertura -> Núcleo -> Seguimiento -> Cierre)."""
    recipient_key = (recipient or "general").lower()
    recipient_desc = RECIPIENT_DESCRIPTIONS.get(recipient_key, RECIPIENT_DESCRIPTIONS["general"])
    goal_str = (goal or "").strip() or "Conversación guiada"

    key = (groq_api_key or "").strip() or get_server_groq_api_key()
    if key:
        user_info = ""
        if user_context and user_context.strip():
            user_info = f"\nDATOS PERSONALES DEL USUARIO:\n\"\"\"\n{user_context.strip()[:1500]}\n\"\"\"\n"

        prompt = f"""Eres un asistente de comunicación aumentativa (AAC) que ayuda a una persona no verbal a planificar y guiar una conversación por etapas.
- Destinatario: {recipient_desc}
- Objetivo de la conversación: {goal_str}
{user_info}
{grammatical_instruction(grammatical_form)}
Tono: {tone}

Estructura la conversación en 4 etapas lógicas:
1. "apertura": Saludo y encuadre inicial (saludo cordial y aviso respetuoso de que usa un comunicador).
2. "nucleo": Mensaje o petición central de forma clara.
3. "seguimiento": Respuesta prevista a posibles preguntas o detalles adicionales.
4. "cierre": Cierre, agradecimiento y despedida cordial.

Para CADA una de las 4 etapas, proporciona exactamente 3 opciones de frases en primera persona en español (con variaciones: directa, amable, detallada).
Devuelve EXCLUSIVAMENTE este formato JSON:
{{
  "stages": [
    {{ "id": "apertura", "title": "1. Saludo y Encuadre", "options": ["opcion1", "opcion2", "opcion3"] }},
    {{ "id": "nucleo", "title": "2. Mensaje Principal", "options": ["opcion1", "opcion2", "opcion3"] }},
    {{ "id": "seguimiento", "title": "3. Si me preguntan detalles", "options": ["opcion1", "opcion2", "opcion3"] }},
    {{ "id": "cierre", "title": "4. Cierre y Agradecimiento", "options": ["opcion1", "opcion2", "opcion3"] }}
  ]
}}"""

        try:
            res = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={
                    "model": DEFAULT_GROQ_MODEL,
                    "messages": [{"role": "system", "content": prompt}],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.6,
                    "max_tokens": 800,
                },
                timeout=4.0,
            )
            if res.status_code == 200:
                data = res.json()
                raw = json.loads(data["choices"][0]["message"]["content"])
                stages = raw.get("stages", [])
                if isinstance(stages, list) and len(stages) >= 4:
                    return {"stages": stages, "engine": "groq", "recipient": recipient_key, "goal": goal_str}
        except Exception as e:
            logger.warning(f"Groq guided storyboard error: {e}")

    # Comprehensive heuristic storyboard
    if recipient_key == "medico":
        stages = [
            {
                "id": "apertura",
                "title": "1. Saludo y Encuadre",
                "options": [
                    personal_form("Hola doctor/a. Uso este comunicador para hablar y he preparado lo que quiero consultarle.", grammatical_form),
                    personal_form("Buenos días. Gracias por atenderme; le explicaré con mi comunicador lo que me ocurre.", grammatical_form),
                    personal_form("Hola. Por favor, deme un momento mientras selecciono mis frases.", grammatical_form)
                ]
            },
            {
                "id": "nucleo",
                "title": "2. Mensaje Principal",
                "options": [
                    personal_form(f"Vengo por este motivo: {goal_str}. Empezó hace unos días y me preocupa.", grammatical_form),
                    personal_form(f"Quería pedirle su opinión médica sobre {goal_str} porque me genera molestias.", grammatical_form),
                    personal_form(f"Necesito que valoremos {goal_str} y ver si podemos hacer alguna prueba o ajuste.", grammatical_form)
                ]
            },
            {
                "id": "seguimiento",
                "title": "3. Si me preguntan detalles",
                "options": [
                    personal_form("El malestar es continuo, sobre todo al final del día o al hacer esfuerzo.", grammatical_form),
                    personal_form("No tengo fiebre, pero noto que la medicación habitual no está haciendo efecto.", grammatical_form),
                    personal_form("Comenzó la semana pasada de forma gradual y no ha mejorado.", grammatical_form)
                ]
            },
            {
                "id": "cierre",
                "title": "4. Cierre y Agradecimiento",
                "options": [
                    personal_form("¿Qué pauta o tratamiento me recomienda seguir ahora? Muchas gracias.", grammatical_form),
                    personal_form("Muchas gracias por su atención y por escucharme con paciencia.", grammatical_form),
                    personal_form("Entendido. Seguiré sus indicaciones y pediré cita si no mejoro.", grammatical_form)
                ]
            }
        ]
    elif recipient_key == "familia":
        stages = [
            {
                "id": "apertura",
                "title": "1. Saludo y Encuadre",
                "options": [
                    personal_form("Hola. Quería comentaros algo importante con calma.", grammatical_form),
                    personal_form("Buenas. ¿Tenéis un momento para escuchar lo que he preparado?", grammatical_form),
                    personal_form("Hola familia. Me gustaría hablar un momento con vosotros.", grammatical_form)
                ]
            },
            {
                "id": "nucleo",
                "title": "2. Mensaje Principal",
                "options": [
                    personal_form(f"El tema es: {goal_str}. Me gustaría que me ayudarais con esto.", grammatical_form),
                    personal_form(f"He estado pensando en {goal_str} y quería compartir mi punto de vista.", grammatical_form),
                    personal_form(f"Necesito vuestro apoyo con respecto a {goal_str}.", grammatical_form)
                ]
            },
            {
                "id": "seguimiento",
                "title": "3. Si me preguntan detalles",
                "options": [
                    personal_form("Lo he pensado bien y creo que es lo mejor para todos.", grammatical_form),
                    personal_form("Podemos hacerlo paso a paso, sin prisa.", grammatical_form),
                    personal_form("Si no es posible ahora, podemos buscar otra alternativa.", grammatical_form)
                ]
            },
            {
                "id": "cierre",
                "title": "4. Cierre y Agradecimiento",
                "options": [
                    personal_form("Gracias por escucharme y por comprender mi situación.", grammatical_form),
                    personal_form("Me alegra mucho que lo hayamos hablado tranquilamente.", grammatical_form),
                    personal_form("Os quiero mucho, gracias por vuestra paciencia.", grammatical_form)
                ]
            }
        ]
    elif recipient_key == "amigo":
        stages = [
            {
                "id": "apertura",
                "title": "1. Saludo y Encuadre",
                "options": [
                    personal_form("¡Hola! Me alegro mucho de verte. Quería comentarte algo chulo.", grammatical_form),
                    personal_form("¡Qué tal! Tenía muchas ganas de hablar contigo hoy.", grammatical_form),
                    personal_form("Hola amigo/a, dame un segundo para poner mis frases.", grammatical_form)
                ]
            },
            {
                "id": "nucleo",
                "title": "2. Mensaje Principal",
                "options": [
                    personal_form(f"Quería proponerte esto: {goal_str}.", grammatical_form),
                    personal_form(f"Te quería contar lo que me ha pasado con {goal_str}.", grammatical_form),
                    personal_form(f"¿Qué opinas sobre {goal_str}? Me interesa tu opinión.", grammatical_form)
                ]
            },
            {
                "id": "seguimiento",
                "title": "3. Si me preguntan detalles",
                "options": [
                    personal_form("Sería para hacerlo tranquilamente cuando te venga bien.", grammatical_form),
                    personal_form("Me pareció muy curioso y quería compartirlo contigo.", grammatical_form),
                    personal_form("Tú decides, yo me adapto a lo que prefieras.", grammatical_form)
                ]
            },
            {
                "id": "cierre",
                "title": "4. Cierre y Agradecimiento",
                "options": [
                    personal_form("¡Genial! Hablamos pronto y seguimos en contacto.", grammatical_form),
                    personal_form("Muchas gracias por el rato, me lo he pasado muy bien.", grammatical_form),
                    personal_form("¡Un abrazo fuerte y hasta la próxima!", grammatical_form)
                ]
            }
        ]
    else:
        stages = [
            {
                "id": "apertura",
                "title": "1. Saludo y Encuadre",
                "options": [
                    personal_form("Hola, buenos días. Uso un comunicador asistido para expresarme.", grammatical_form),
                    personal_form("Buenas. He preparado unas notas para hablar de forma ordenada.", grammatical_form),
                    personal_form("Hola. Gracias por su tiempo y paciencia.", grammatical_form)
                ]
            },
            {
                "id": "nucleo",
                "title": "2. Mensaje Principal",
                "options": [
                    personal_form(f"El motivo de mi consulta es: {goal_str}.", grammatical_form),
                    personal_form(f"Quisiera solicitar información o ayuda con respecto a {goal_str}.", grammatical_form),
                    personal_form(f"Me gustaría plantearle una duda sobre {goal_str}.", grammatical_form)
                ]
            },
            {
                "id": "seguimiento",
                "title": "3. Si me preguntan detalles",
                "options": [
                    personal_form("Tengo aquí todos los datos necesarios si necesita consultarlos.", grammatical_form),
                    personal_form("Cualquier opción que me facilite la gestión me parecerá bien.", grammatical_form),
                    personal_form("Prefiero hacerlo de la manera más sencilla y directa.", grammatical_form)
                ]
            },
            {
                "id": "cierre",
                "title": "4. Cierre y Agradecimiento",
                "options": [
                    personal_form("Muchas gracias por su atención y excelente trato.", grammatical_form),
                    personal_form("Que tenga un buen día y gracias por su paciencia.", grammatical_form),
                    personal_form("Quedo a la espera de sus indicaciones. Muchas gracias.", grammatical_form)
                ]
            }
        ]

    return {"stages": stages, "engine": "heuristic", "recipient": recipient_key, "goal": goal_str}

