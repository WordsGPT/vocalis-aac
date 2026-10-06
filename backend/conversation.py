"""Generate context-aware AAC suggestions for multi-party conversations."""
import json
import logging

import requests

from backend.engine import (DEFAULT_GROQ_MODEL, GROQ_API_URL, get_server_groq_api_key,
                            get_smart_suggestions, grammatical_instruction, personal_form, sanitize_sentence)

logger = logging.getLogger(__name__)


def fallback_decision(text, history=None, count=6, tone="natural", grammatical_form="masculine", user_context=None, focus_topic=None, mode="reply", topic_context=None):
    """On Groq conversation failure, use smart suggestion engine fallback."""
    if focus_topic and focus_topic.strip():
        ft = focus_topic.strip()
        if mode == "speak":
            pivot_suggestions = [
                f"Quería proponer algo sobre lo de {ft}.",
                f"Volviendo a {ft}, yo pienso que deberíamos decidirlo ya.",
                f"Tengo una idea sobre {ft} que no te dije antes.",
                f"Me gustaría retomar {ft} y enfocarlo de otra forma.",
                f"Sobre lo que hablamos de {ft}, yo prefiero tomar la iniciativa.",
                f"¿Y si cerramos primero lo pendiente de {ft}?"
            ][:count]
        else:
            pivot_suggestions = [
                f"Volviendo a lo que dijimos sobre {ft}...",
                f"Sobre {ft}, ¿qué opinas de lo que comentamos?",
                f"Quería retomar lo de {ft} que hablamos antes.",
                f"¿Y al final qué hacemos con {ft}?",
                f"Por cierto, me quedé pensando en lo de {ft}.",
                f"Antes de continuar, quería aclarar algo de {ft}."
            ][:count]
        return {
            "should_suggest": True,
            "reason": "topic_pivot",
            "suggestions": pivot_suggestions,
            "topics": [ft],
            "engine": "heuristic"
        }
    if mode == "speak":
        speak_suggestions = [
            "Tengo una idea sobre eso que podríamos probar.",
            "Quería decirte lo que opino sobre este tema.",
            "¿Y si lo enfocamos de otra manera totalmente distinta?",
            "A mí me gustaría mucho que hiciéramos un plan con eso.",
            "Cambiando un poco de rumbo, quería comentarte algo.",
            "¿Qué te parecería si tomamos la iniciativa nosotros?"
        ][:count]
        words = [w.strip("¿?¡!.,;:\"'()").capitalize() for w in text.split()]
        stopwords = {"que", "como", "cuando", "donde", "quien", "porque", "para", "pero", "este", "esta", "estos", "estas", "hola", "adios", "bueno", "bien", "vamos", "tengo", "quiero", "puedo", "hacer", "todo", "nada"}
        extracted = [w for w in words if len(w) >= 4 and w.lower() not in stopwords]
        topics = list(dict.fromkeys(extracted))[:3]
        return {
            "should_suggest": True,
            "reason": "speak_initiative",
            "suggestions": [personal_form(s, grammatical_form) for s in speak_suggestions],
            "topics": topics,
            "engine": "heuristic"
        }
    res = get_smart_suggestions(
        partner_text=text,
        history=history,
        tone=tone,
        count=count,
        user_context=user_context,
        grammatical_form=grammatical_form
    )
    words = [w.strip("¿?¡!.,;:\"'()").capitalize() for w in text.split()]
    stopwords = {"que", "como", "cuando", "donde", "quien", "porque", "para", "pero", "este", "esta", "estos", "estas", "hola", "adios", "bueno", "bien", "vamos", "tengo", "quiero", "puedo", "hacer", "todo", "nada"}
    extracted = [w for w in words if len(w) >= 4 and w.lower() not in stopwords]
    topics = list(dict.fromkeys(extracted))[:3]
    return {
        "should_suggest": True,
        "reason": "natural_opening",
        "suggestions": res.get("suggestions", []),
        "topics": topics,
        "engine": res.get("engine", "heuristic")
    }


def conversation_suggestions(text, history=None, count=6, tone="natural", grammatical_form="masculine", api_key=None, user_context=None, focus_topic=None, mode="reply", topic_context=None):
    key = (api_key or "").strip() or get_server_groq_api_key()
    count = max(3, min(count, 8))
    if not key:
        return fallback_decision(text, history, count, tone, grammatical_form, user_context=user_context, focus_topic=focus_topic, mode=mode, topic_context=topic_context)

    context_turns = 32 if focus_topic else 16
    context = [{"speaker": "Yo" if item.get("role") == "user" else item.get("speaker_label") or "Voz sin identificar",
                "text": (item.get("content") or item.get("text") or "")[:2000]} for item in (history or [])[-context_turns:]]
    user_info = ""
    if user_context and user_context.strip():
        user_info = f"""
INFORMACIÓN Y DATOS PERSONALES DEL USUARIO (úsalos fielmente para responder preguntas sobre su nombre, vida, preferencias o detalles):
\"\"\"
{user_context.strip()[:2000]}
\"\"\"
"""
    topic_instruction = ""
    if focus_topic and focus_topic.strip():
        ft = focus_topic.strip()
        topic_history_snippets = []
        for h in (history or []):
            content = (h.get("content") or h.get("text") or "").strip()
            speaker = "Yo" if (h.get("role") == "user" or h.get("sender") == "user") else (h.get("speaker_label") or "Interlocutor")
            if ft.lower() in content.lower():
                topic_history_snippets.append(f"- {speaker}: \"{content}\"")
        
        context_block = ""
        if topic_history_snippets:
            context_block = f"""
LO QUE SE DIJO PREVIAMENTE EN LA CONVERSACIÓN SOBRE '{ft}':
{chr(10).join(topic_history_snippets[:6])}
"""
        elif topic_context and topic_context.strip():
            context_block = f"""
CONTEXTO PREVIO SOBRE EL TEMA '{ft}':
{topic_context.strip()[:1000]}
"""

        topic_instruction = f"""
ATENCIÓN - ENFOQUE DE TEMA SOLICITADO / CALLBACK CONTEXTUAL:
El usuario ha seleccionado volver al tema: '{ft}'.
{context_block}
INSTRUCCIONES PARA EL CALLBACK (RETOMAR EL TEMA CON CONTEXTO):
Usa el contexto previo indicado arriba sobre '{ft}' para que las {count} respuestas no sean genéricas. Deben hacer referencia precisa a los detalles específicos, opiniones, acuerdos o dudas que se hablaron antes sobre '{ft}', permitiendo al usuario retomar la conversación con pleno conocimiento de lo dicho previamente (ej: aludir al dato mencionado, resolver lo que quedó pendiente o dar una respuesta conectada con lo anterior).
"""

    if mode == "speak":
        guidance = f"""MODO ACTIVO: MODO HABLAR / DIRIGIR LA CONVERSACIÓN.
El usuario ha activado el MODO HABLAR. En este modo, las sugerencias NO DEBEN SER REACTIVAS NI LIMITARSE A CONTESTAR O RESPONDER pasivamente a lo que acaban de decir.
En su lugar, deben DIRIGIR LA CONVERSACIÓN y expresar lo que el usuario QUIERE DECIR, PROPONER O CONTAR, basándose en lo que se ha dicho en la conversación pero tomando la iniciativa y llevando el rumbo del diálogo:

PAUTAS PARA MODO HABLAR:
1. DIRIGIR LA CONVERSACIÓN Y TOMAR LA INICIATIVA:
   - Proponer nuevos temas, planes o siguientes pasos relacionados con lo hablado ("¿Y si nos organizamos para...?", "Tengo una idea mejor sobre esto...", "Cambiando de tema, quería proponerte algo...").
   - Enfocar el diálogo en lo que el usuario considera prioritario ("Lo principal ahora es...", "Quiero que hablemos de...").
2. EXPRESAR LO QUE EL USUARIO QUIERE DECIR O APORTAR:
   - Expresar pensamientos, convicciones o experiencias personales sobre el tema ("A mí me apetece mucho...", "Yo pienso que deberíamos...", "Quería compartirte lo que pienso de esto...").
   - Expresar deseos, intenciones o decisiones propias de forma clara y asertiva ("Tengo ganas de...", "Lo que yo quiero hacer es...").
3. PREGUNTAS DE LIDERAZGO:
   - Preguntas que orientan al interlocutor hacia una acción o nuevo rumbo ("¿Cómo piensas que lo enfoquemos?", "¿Qué te parece si yo me encargo de...?", "¿Cuándo empezamos?").
4. CONECTAR CON LO HABLADO SIN SER REACTIVO:
   - Usa lo escuchado como contexto de fondo, pero NO te limites a contestar a la última pregunta ni a dar confirmaciones pasivas. La persona no verbal lidera y propone."""
    else:
        guidance = """ADAPTACIÓN INTELIGENTE SEGÚN EL TIPO DE MENSAJE:
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
   - Ofrece saludos cálidos, devoluciones de saludo, agradecimiento o comentarios casuales según el estado de ánimo."""

    prompt = f"""Eres el sistema de sugerencias de un comunicador aumentativo (AAC) para una persona no verbal en una conversación real en directo.
Tu misión es generar {count} opciones de respuesta COHERENTES, ÚTILES y NATURALES para lo que se acaba de escuchar, ofreciendo VARIEDAD REAL DE POSTURAS CONVERSACIONALES sin caer en plantillas forzadas ni respuestas repetitivas.
Los turnos de 'Yo' son frases que la persona ya dijo. Las etiquetas 'Persona N' son quién habla.{user_info}{topic_instruction}
Acaba de escucharse: "{text}".

{guidance}

REGLAS GENERALES:
- Genera exactamente {count} opciones.
- Cada opción debe representar una intención conversacional diferente (afinidad, matiz, curiosidad, alternativa o empatía), pero SIEMPRE adaptada con sentido común a la situación real.
- Primera persona, frases en español natural y fluido, listas para ser habladas por sintetizador de voz.
- Prohibido repetir la misma idea con palabras similares o hacer múltiples preguntas redundantes.
- Tono: {tone}.
- No repitas lo que 'Yo' ya dijo recientemente.
- Si la pregunta o mensaje se refiere a la identidad, nombre, gustos o datos del usuario, utiliza SIEMPRE la INFORMACIÓN PERSONAL proporcionada arriba de forma exacta y coherente.

Devuelve exclusivamente JSON con el formato: {{"should_suggest": true, "reason": "natural_opening", "suggestions": ["...", ...], "topics": ["Tema1", "Tema2"]}}.
"topics" debe ser una lista de 1 a 3 sustantivos o conceptos clave principales de los que se está hablando en esta conversación (sustantivos concisos en español, con mayúscula inicial, ej: ["Mercado", "Queso", "Cine"]).
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
            return fallback_decision(text, history, count, tone, grammatical_form, user_context=user_context, focus_topic=focus_topic, mode=mode, topic_context=topic_context)
        reason = data.get("reason", "natural_opening" if mode != "speak" else "speak_initiative")
        raw_topics = data.get("topics", [])
        topics = []
        if isinstance(raw_topics, list):
            for item in raw_topics:
                if isinstance(item, str):
                    c_topic = item.strip().capitalize()
                    if c_topic and len(c_topic) <= 25 and c_topic not in topics:
                        topics.append(c_topic)
        if focus_topic and focus_topic.strip():
            clean_ft = focus_topic.strip().capitalize()
            if clean_ft not in topics:
                topics.insert(0, clean_ft)
        return {"should_suggest": True, "reason": reason,
                "suggestions": suggestions, "topics": topics, "engine": "groq-conversation"}
    except Exception as exc:
        logger.warning(f"Conversation suggestions unavailable via Groq: {exc}")
        return fallback_decision(text, history, count, tone, grammatical_form, user_context=user_context, focus_topic=focus_topic, mode=mode, topic_context=topic_context)
