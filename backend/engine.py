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
    # Question patterns:
    {
        "patterns": [r"\bhow are you\b", r"\bhow'?s it going\b", r"\bhow do you feel\b"],
        "responses": [
            "I'm doing well, thanks for asking! How are you?",
            "Can't complain! Just taking things easy today.",
            "A bit tired today, but hanging in there."
        ]
    },
    {
        "patterns": [r"\bwhat do you think\b", r"\bany thoughts\b", r"\bopinion\b"],
        "responses": [
            "I think that sounds like a great idea!",
            "I'm not entirely sure yet, let me think about it.",
            "I have some reservations, could we discuss alternatives?"
        ]
    },
    {
        "patterns": [r"\bcoffee\b|\btea\b|\bdrink\b|\bbeverage\b|\blunch\b|\bfood\b|\beat\b"],
        "responses": [
            "That sounds delicious, count me in!",
            "I'll just take some water, thank you.",
            "I'm not hungry right now, but you go ahead!"
        ]
    },
    {
        "patterns": [r"\bfree\b|\bavailable\b|\btime\b|\bjoin\b|\bmeet\b"],
        "responses": [
            "Yes, I'm completely free! Let's do it.",
            "What time were you thinking?",
            "Sorry, I'm tied up with something right now."
        ]
    },
    {
        "patterns": [r"\bhelp\b|\bneed a hand\b|\bassist\b"],
        "responses": [
            "Yes please, I would really appreciate some help!",
            "I might need a moment, let me see first.",
            "I'm all good on my own, thank you though!"
        ]
    },
    {
        "patterns": [r"\bwhere\b|\blocation\b|\bplace\b"],
        "responses": [
            "Anywhere you prefer works for me!",
            "Could we pick somewhere quiet?",
            "I'd rather stay here if that's okay."
        ]
    },
    {
        "patterns": [r"\bthanks\b|\bthank you\b|\bappreciate\b"],
        "responses": [
            "You're very welcome!",
            "Happy to help anytime.",
            "No problem at all!"
        ]
    }
]

DEFAULT_FALLBACK = [
    "Yes, absolutely, I agree!",
    "Could you tell me a little more?",
    "I'm not sure about that, let me think."
]

def generate_heuristic_responses(text: str) -> List[str]:
    """Pattern matching fallback when LLM is unavailable or offline."""
    lower = text.lower().strip()
    if not lower:
        return [
            "Hello! How are you?",
            "Nice to see you!",
            "One moment, I'm typing."
        ]
    
    for entry in HEURISTIC_TEMPLATES:
        for pat in entry["patterns"]:
            if re.search(pat, lower):
                return entry["responses"]
    
    # Generic question vs statement
    if lower.endswith("?"):
        return [
            "Yes, definitely!",
            "Maybe, let's see how it goes.",
            "Probably not right now."
        ]
    else:
        return [
            "Sounds good to me!",
            "That's interesting, tell me more.",
            "I understand, thanks for letting me know."
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
        "casual": "Keep answers relaxed, casual, and friendly.",
        "professional": "Keep answers polite, professional, and clear.",
        "concise": "Keep answers short (3-6 words).",
        "warm": "Keep answers warm, enthusiastic, and empathetic."
    }.get(tone, "Keep answers natural, conversational, and direct.")

    prompt = f"""You are an AAC speech assistant for a non-verbal person communicating in live conversation.
Someone just said to them:
"{partner_text}"

Generate 3 natural, complete, first-person spoken responses they can choose to speak aloud:
1. affirmative: friendly agreement, acceptance, or enthusiasm
2. thoughtful: inquiring question, neutral remark, or alternative idea
3. decline: polite decline, boundary, or opposite preference

Tone: {tone_instruction}
Rules:
- Speak directly in the first person ("I", "me", "we").
- Each response MUST be a complete, natural sentence (4 to 12 words).
- Never output incomplete fragments (do NOT output "I" or "I want").
- Do NOT use brackets or placeholders like [insert topic].
- Ready to be spoken out loud immediately via text-to-speech."""

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
    prompt = f"""You are assisting a non-verbal person who uses an AAC speech device in real-time conversation.
Someone just said to them:
"{partner_text}"

Suggest exactly 3 first-person responses they can choose between to speak aloud:
1. (Positive/Agree)
2. (Inquire/Neutral/Alternative)
3. (Polite decline/Disagree)

Respond ONLY with a valid JSON array of 3 strings. Example: ["Yes, let's do it!", "Could we do it tomorrow?", "I can't make it, sorry."]"""

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
        "casual": "Keep answers relaxed, casual, and friendly.",
        "professional": "Keep answers polite, professional, and clear.",
        "concise": "Keep answers short (3-6 words).",
        "warm": "Keep answers warm, enthusiastic, and empathetic."
    }.get(tone, "Keep answers natural, conversational, and direct.")

    system_prompt = f"""You are an assistive voice communicator for a non-verbal person in a live ongoing conversation.
In the message history:
- 'user' represents what the conversational partner spoke.
- 'assistant' represents what you (the non-verbal person) previously chose to speak out loud.

The partner just spoke the latest message.
Based on the full conversation thread and where you are right now, suggest exactly 3 natural, complete, first-person spoken responses in JSON format:
{{
  "affirmative": "positive/accepting response fitting this exact moment (4-12 words)",
  "thoughtful": "inquiring question or alternative fitting this exact moment (4-12 words)",
  "decline": "polite decline or boundary fitting this exact moment (4-12 words)"
}}
Tone: {tone_instruction}
Rules:
- Speak directly in the first person ("I", "me", "we").
- Context-aware: Answer the current topic knowing what was already discussed, never repeat previous answers.
- Complete, natural sentences ready to be spoken aloud via TTS."""

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
                "Hello, how can I help you?",
                "Give me just a second.",
                "Nice to see you!"
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
