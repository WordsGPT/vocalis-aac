"""Generate context-aware AAC suggestions for multi-party conversations."""
import json
import logging

import requests

from backend.engine import (DEFAULT_GROQ_MODEL, GROQ_API_URL, get_server_groq_api_key,
                            get_smart_suggestions, grammatical_instruction, personal_form, sanitize_sentence)

logger = logging.getLogger(__name__)


def fallback_decision(text, history=None, count=6, tone="natural", grammatical_form="masculine", user_context=None):
    """On Groq conversation failure, use smart suggestion engine fallback."""
    res = get_smart_suggestions(
        partner_text=text,
        history=history,
        tone=tone,
        count=count,
        user_context=user_context,
        grammatical_form=grammatical_form
    )
    return {
        "should_suggest": True,
        "reason": "natural_opening",
        "suggestions": res.get("suggestions", []),
        "engine": res.get("engine", "heuristic")
    }


def conversation_suggestions(text, history=None, count=6, tone="natural", grammatical_form="masculine", api_key=None, user_context=None):
    key = (api_key or "").strip() or get_server_groq_api_key()
    count = max(3, min(count, 8))
    if not key:
        return fallback_decision(text, history, count, tone, grammatical_form, user_context=user_context)

    context = [{"speaker": "Yo" if item.get("role") == "user" else item.get("speaker_label") or "Voz sin identificar",
                "text": (item.get("content") or "")[:2000]} for item in (history or [])[-16:]]
    user_info = ""
    if user_context and user_context.strip():
        user_info = f"""
INFORMACIÓN Y DATOS PERSONALES DEL USUARIO (úsalos fielmente para responder preguntas sobre su nombre, vida, preferencias o detalles):
\"\"\"
{user_context.strip()[:2000]}
\"\"\"
"""
    prompt = f"""Eres el sistema de sugerencias de un comunicador aumentativo (AAC) para una persona no verbal en una conversación real en directo.
El usuario necesita MÁXIMA DIVERSIDAD DE INTENCIONES en sus opciones para poder elegir qué decir.
Los turnos de 'Yo' son frases que la persona ya dijo. Las etiquetas 'Persona N' son quién habla.{user_info}
Acaba de escucharse: "{text}".

Debes generar exactamente {count} opciones, cada una con una INTENCIÓN y postura conversacional TOTALMENTE DIFERENTE a las demás:
1. ACUERDO / AFIRMACIÓN: Aceptar con entusiasmo, decir que sí, sumarse o mostrar acuerdo.
2. RECHAZO / NEGATIVA: Decir que no educadamente, declinar o mostrar desacuerdo respetuoso.
3. PREGUNTA CLAVE / CURIOSIDAD: Preguntar un detalle concreto y curioso sobre el tema para saber más.
4. ALTERNATIVA / PROPUESTA: Sugerir otra idea, otro plan, otra hora o punto de vista diferente.
5. REACCIÓN / EMPATÍA: Un comentario afectuoso, de humor, sorpresa, apoyo o empatía.
6. DUDA / TIEMPO / MATIZ: "Luego te digo", "depende", "déjame pensarlo" o una respuesta neutral.

REGLAS ESTRICTAS:
- Si la pregunta o mensaje se refiere a la identidad, nombre, gustos o datos del usuario, utiliza SIEMPRE la INFORMACIÓN PERSONAL proporcionada arriba de forma exacta y coherente.
- Primera persona, frases breves (3 a 10 palabras), en español natural y listas para hablar.
- Las {count} opciones DEBEN ser claramente distintas entre sí: prohibido repetir la misma idea o hacer múltiples preguntas redundantes.
- Tono: {tone}.
- No repitas lo que 'Yo' ya dijo recientemente.
Devuelve exclusivamente JSON con el formato: {{"should_suggest": true, "reason": "natural_opening", "suggestions": ["...", ...]}}.
{grammatical_instruction(grammatical_form)}"""
    try:
        response = requests.post(GROQ_API_URL, headers={"Authorization": f"Bearer {key}"}, json={
            "model": DEFAULT_GROQ_MODEL,
            "messages": [{"role": "system", "content": prompt}, {"role": "user", "content": json.dumps(
                {"conversation": context, "latest_audio": text[:4000]}, ensure_ascii=False)}],
            "response_format": {"type": "json_object"}, "temperature": 0.6,
        }, timeout=8)
        response.raise_for_status()
        raw = response.json()["choices"][0]["message"]["content"]
        data = json.loads(raw)
        candidates = data.get("suggestions", [])
        if not isinstance(candidates, list):
            candidates = []
        suggestions = list(dict.fromkeys(personal_form(cleaned, grammatical_form)
                           for item in candidates if (cleaned := sanitize_sentence(item, ""))))[:count]
        if not suggestions:
            return fallback_decision(text, history, count, tone, grammatical_form)
        reason = data.get("reason", "natural_opening")
        return {"should_suggest": True, "reason": reason,
                "suggestions": suggestions, "engine": "groq-conversation"}
    except Exception as exc:
        logger.warning(f"Conversation suggestions unavailable via Groq: {exc}")
        return fallback_decision(text, history, count, tone, grammatical_form)
