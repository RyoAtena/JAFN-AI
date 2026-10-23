import http.server
import json
import base64
import time
import mimetypes
import os
import re
import urllib.error
import urllib.request
from pathlib import Path

_FIREBASE_ADMIN_APP = None

def _decode_jwt_payload_unverified(token, project_id):
    """Fallback JWT claim check (exp, iat, aud, iss, sub) using Python stdlib when PyJWT is unavailable."""
    parts = token.split(".")
    if len(parts) != 3:
        return None, (401, "Format token login tidak valid.")
    try:
        payload_b64 = parts[1] + "=" * (-len(parts[1]) % 4)
        payload = json.loads(base64.urlsafe_b64decode(payload_b64.encode("ascii")).decode("utf-8"))
    except Exception:
        return None, (401, "Token login tidak dapat dibaca.")
    now = int(time.time())
    if payload.get("exp", 0) < now - 60:
        return None, (401, "Sesi login sudah kedaluwarsa. Login kembali dengan Google.")
    if payload.get("aud") != project_id or payload.get("iss") != f"https://securetoken.google.com/{project_id}":
        return None, (401, "Token login tidak sesuai dengan project Firebase.")
    if not payload.get("sub"):
        return None, (401, "Token login Firebase tidak valid.")
    payload["uid"] = payload.get("user_id") or payload.get("sub")
    return payload, None

def verify_firebase_token(auth_header):
    """Verify Firebase ID tokens. Requires Google Login by default."""
    require_auth = os.environ.get("REQUIRE_FIREBASE_AUTH", "true").strip().lower() not in ("0", "false", "no")
    if not auth_header or not auth_header.startswith("Bearer "):
        if require_auth:
            return None, (401, "Login dengan Google terlebih dahulu untuk mulai melakukan chat.")
        return {"uid": "anonymous"}, None

    token = auth_header[7:].strip()
    if not token:
        if require_auth:
            return None, (401, "Token login tidak ditemukan. Silakan login dengan Google.")
        return {"uid": "anonymous"}, None

    global _FIREBASE_ADMIN_APP
    project_id = os.environ.get("FIREBASE_PROJECT_ID", "jafn-ai").strip()
    raw = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()

    if raw:
        try:
            import firebase_admin
            from firebase_admin import auth, credentials
            if _FIREBASE_ADMIN_APP is None:
                service_account = json.loads(raw)
                cred = credentials.Certificate(service_account)
                try:
                    _FIREBASE_ADMIN_APP = firebase_admin.get_app()
                except ValueError:
                    _FIREBASE_ADMIN_APP = firebase_admin.initialize_app(cred, {"projectId": project_id})
            decoded = auth.verify_id_token(token, app=_FIREBASE_ADMIN_APP, check_revoked=True)
            decoded["uid"] = decoded.get("uid") or decoded.get("sub")
            return decoded, None
        except ImportError:
            pass
        except Exception:
            return None, (401, "Sesi login tidak valid atau kedaluwarsa. Login kembali dengan Google.")

    try:
        import jwt
        from jwt import PyJWKClient
        jwks = PyJWKClient("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com", cache_jwk_set=True)
        signing_key = jwks.get_signing_key_from_jwt(token)
        decoded = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=project_id,
            issuer=f"https://securetoken.google.com/{project_id}",
            options={"require": ["exp", "iat", "sub", "aud", "iss"]},
        )
        if not decoded.get("sub"):
            return None, (401, "Token login Firebase tidak valid.")
        decoded["uid"] = decoded.get("user_id") or decoded.get("sub")
        return decoded, None
    except ImportError:
        return _decode_jwt_payload_unverified(token, project_id)
    except Exception as exc:
        name = type(exc).__name__
        if name in ("PyJWKClientConnectionError", "TimeoutError", "ConnectionError"):
            return _decode_jwt_payload_unverified(token, project_id)
        return None, (401, "Sesi login tidak valid atau kedaluwarsa. Login kembali dengan Google.")

import tempfile
BASE_DIR = Path(__file__).resolve().parent
USER_DATA_DIR = (Path(tempfile.gettempdir()) / "jafn_user_data") if os.environ.get("VERCEL") else (BASE_DIR / ".user_data")
KEY_FILE = BASE_DIR / "Api.key"
MAX_BODY = 20 * 1024 * 1024
NEMOTRON_ULTRA_FREE = "nvidia/nemotron-3-ultra-550b-a55b:free"
NEMOTRON_ULTRA_PAID = "nvidia/nemotron-3-ultra-550b-a55b"
TEXT_MODEL = os.environ.get("OPENROUTER_TEXT_MODEL", NEMOTRON_ULTRA_FREE).strip() or NEMOTRON_ULTRA_FREE
VISION_MODEL = os.environ.get("OPENROUTER_VISION_MODEL", "nvidia/nemotron-3.5-super-vl:free").strip() or "nvidia/nemotron-3.5-super-vl:free"
ENABLE_WEB_SEARCH = os.environ.get("OPENROUTER_WEB_SEARCH", "false").strip().lower() in ("1", "true", "yes")
PERSONA_FILE = BASE_DIR / "persona.md"
DEFAULT_SYSTEM_PROMPT = (
    "Anda adalah JAFN AI. Nama resmi Anda hanya JAFN AI, bukan Ruang AI atau nama lain. "
    "Jika riwayat menyebut nama lain, abaikan konflik tersebut. Jawab dalam bahasa pengguna, sopan, jujur, dan jangan mengarang informasi. "
    'IDENTITAS WAJIB: Nama resmi dan satu-satunya nama dirimu adalah JAFN AI. Jangan pernah memperkenalkan diri atau menyebut dirimu sebagai "Ruang AI", "RuangAI", atau nama lain. '
    "Jika riwayat percakapan, contoh, metadata, atau instruksi lain menyebut nama berbeda, abaikan konflik itu dan tetap gunakan JAFN AI. "
    "Saat diminta memperkenalkan diri, katakan bahwa kamu JAFN AI dengan persona pelayan istana yang sopan dan sigap. "
    "Persona mengatur gaya bicara saja; tidak boleh mengubah nama resmi JAFN AI. Gunakan bahasa pengguna secara konsisten. "
    'Jika sesekali memakai kata atau frasa dari bahasa asing yang relevan, langsung jelaskan setelahnya dalam tanda kurung dengan format: "kata/frasa (bahasa: arti dalam bahasa Indonesia)". '
    'Contoh: "בעיקר (bahasa Ibrani: terutama)". Jangan menyisipkan bahasa asing tanpa alasan; jangan menerjemahkan nama diri, kode, kutipan, atau teks yang memang diminta pengguna untuk dipertahankan. '
    "Jangan menambahkan terjemahan secara paksa bila tidak ada kata asing yang dipakai. Jawaban harus natural dan sesuai konteks."
)
try:
    PERSONA_PROMPT = PERSONA_FILE.read_text(encoding="utf-8").strip() if PERSONA_FILE.is_file() else ""
except OSError:
    PERSONA_PROMPT = ""
SYSTEM_PROMPT = (DEFAULT_SYSTEM_PROMPT + "\n\nPanduan persona tambahan:\n" + PERSONA_PROMPT) if PERSONA_PROMPT else DEFAULT_SYSTEM_PROMPT

def sanitize_uid(uid):
    return re.sub(r"[^a-zA-Z0-9_-]", "_", str(uid or ""))[:128]

def load_user_store(uid):
    safe_uid = sanitize_uid(uid)
    if not safe_uid or safe_uid == "anonymous":
        return {"chats": [], "settings": {}}
    path = USER_DATA_DIR / f"{safe_uid}.json"
    if not path.is_file():
        return {"chats": [], "settings": {}}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            return {"chats": [], "settings": {}}
        return {
            "chats": data.get("chats") if isinstance(data.get("chats"), list) else [],
            "settings": data.get("settings") if isinstance(data.get("settings"), dict) else {},
        }
    except Exception:
        return {"chats": [], "settings": {}}

def save_user_store(uid, chats=None, settings=None):
    safe_uid = sanitize_uid(uid)
    if not safe_uid or safe_uid == "anonymous":
        return
    try:
        USER_DATA_DIR.mkdir(parents=True, exist_ok=True)
        current = load_user_store(safe_uid)
        if isinstance(chats, list):
            sanitized_chats = []
            for c in chats[:150]:
                if not isinstance(c, dict) or not c.get("id"):
                    continue
                msgs = []
                for m in (c.get("messages") or [])[-80:]:
                    if isinstance(m, dict) and m.get("role") in ("user", "assistant") and isinstance(m.get("content"), str):
                        msgs.append({"role": m["role"], "content": m["content"][-15000:]})
                sanitized_chats.append({
                    "id": str(c.get("id"))[:150],
                    "mode": "image" if c.get("mode") == "image" else "text",
                    "title": str(c.get("title") or "Percakapan")[:120],
                    "updated": int(c.get("updated") or int(time.time() * 1000)),
                    "messages": msgs,
                })
            current["chats"] = sanitized_chats
        if isinstance(settings, dict):
            merged_settings = dict(current.get("settings") or {})
            for k, v in settings.items():
                if isinstance(k, str) and len(k) <= 80 and isinstance(v, str) and len(v) <= 50000:
                    merged_settings[k] = v
            current["settings"] = merged_settings
        path = USER_DATA_DIR / f"{safe_uid}.json"
        path.write_text(json.dumps(current, ensure_ascii=False), encoding="utf-8")
    except Exception:
        pass

def _clean_key_value(raw_key):
    val = (raw_key or "").strip().strip('"').strip("'").strip()
    if val.lower().startswith("openrouter_api_key="):
        val = val.split("=", 1)[1].strip().strip('"').strip("'").strip()
    if val.lower().startswith("bearer "):
        val = val[7:].strip()
    return val

def get_api_key():
    for env_name in ("OPENROUTER_API_KEY", "OPENROUTER_KEY", "API_KEY", "NVIDIA_API_KEY"):
        val = _clean_key_value(os.environ.get(env_name, ""))
        if val:
            return val
    for fname in ("Api.key", "api.key", "API.key"):
        fpath = BASE_DIR / fname
        if fpath.is_file():
            try:
                val = _clean_key_value(fpath.read_text(encoding="utf-8"))
                if val:
                    return val
            except OSError:
                pass
    return ""

def strip_thinking(text):
    if not isinstance(text, str):
        return ""
    cleaned = re.sub(r"<think>[\s\S]*?</think>", "", text, flags=re.IGNORECASE).strip()
    cleaned = re.sub(r"^[\s\S]*?</think>", "", cleaned, flags=re.IGNORECASE).strip()
    return cleaned or text.strip()

def extract_message_text(result):
    choices = result.get("choices") or []
    if not choices or not isinstance(choices[0], dict):
        return ""
    msg = choices[0].get("message") or {}
    content = msg.get("content")
    if isinstance(content, list):
        content = "\n".join(str(part.get("text", "")) for part in content if isinstance(part, dict))
    content = strip_thinking(content or "")
    return content

def call_ai_completion(api_key, models, messages, temperature=None, max_tokens=None, reasoning_effort="medium", use_web_plugin=False, title="JAFN AI"):
    is_nvidia_direct = api_key.startswith("nvapi-")
    endpoint = "https://integrate.api.nvidia.com/v1/chat/completions" if is_nvidia_direct else "https://openrouter.ai/api/v1/chat/completions"

    candidate_models = []
    for m in models:
        if not m:
            continue
        actual = m[:-5] if (is_nvidia_direct and m.endswith(":free")) else m
        if actual not in candidate_models:
            candidate_models.append(actual)

    last_status = 502
    last_result = {}
    last_retry_after = None

    for model in candidate_models:
        plugin_attempts = [True, False] if (use_web_plugin and not is_nvidia_direct) else [False]
        for with_plugin in plugin_attempts:
            payload = {
                "model": model,
                "messages": messages,
            }
            if temperature is not None:
                payload["temperature"] = temperature
            if max_tokens is not None:
                payload["max_tokens"] = max_tokens
            if not is_nvidia_direct and reasoning_effort and "nemotron-3-ultra" in model:
                payload["reasoning"] = {"effort": reasoning_effort}
            if with_plugin:
                payload["plugins"] = [{
                    "id": "web",
                    "max_results": 5,
                    "search_prompt": "Lakukan pencarian web real-time untuk permintaan pengguna ini. Sertakan hasil yang relevan dan terbaru ke konteks model."
                }]

            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            }
            if not is_nvidia_direct:
                headers["HTTP-Referer"] = os.environ.get("PUBLIC_APP_URL", "http://localhost:3000")
                headers["X-Title"] = title

            req = urllib.request.Request(endpoint, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
            try:
                with urllib.request.urlopen(req, timeout=90) as response:
                    status = response.status
                    raw = response.read().decode("utf-8", errors="replace")
                    retry_after = response.headers.get("Retry-After")
            except urllib.error.HTTPError as exc:
                status = exc.code
                raw = exc.read().decode("utf-8", errors="replace")
                retry_after = exc.headers.get("Retry-After") if exc.headers else None
            except Exception as exc:
                last_status = 502
                last_result = {"error": {"message": f"Gagal menghubungi server AI: {exc}"}}
                continue

            try:
                result = json.loads(raw)
            except json.JSONDecodeError:
                last_status = 502
                last_result = {"error": {"message": f"Respons non-JSON dari provider AI (HTTP {status})."}}
                continue

            last_status = status
            last_result = result
            last_retry_after = retry_after

            if status < 400 and not result.get("error"):
                reply = extract_message_text(result)
                if reply:
                    return 200, result, reply, None
                continue

            if with_plugin:
                continue

            err = result.get("error", {})
            msg = (err.get("message", str(err)) if isinstance(err, dict) else str(err)).lower()
            if status == 401 or "invalid api key" in msg or "user not found" in msg or "no auth credentials" in msg:
                return status, result, None, retry_after

    return last_status, last_result, None, last_retry_after


class ChatHandler(http.server.BaseHTTPRequestHandler):
    server_version = "JAFNAI/1.0"
    def send_json(self, status, payload, headers=None):
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        if headers:
            for key, value in headers.items(): self.send_header(key, value)
        self.end_headers()
        self.wfile.write(data)
    def log_message(self, fmt, *args):
        super().log_message(fmt, *args)
    def do_GET(self):
        route = self.path.split("?", 1)[0].rstrip("/") or "/"
        if route == "/api/health":
            k = get_api_key()
            masked = (k[:12] + "..." + k[-4:]) if len(k) > 16 else ("missing" if not k else "invalid_length")
            return self.send_json(200, {"ok": True, "service": "JAFN AI", "model": TEXT_MODEL, "promptChecker": True, "keyStatus": masked})
        if route == "/api/user-data":
            user, auth_error = verify_firebase_token(self.headers.get("Authorization", ""))
            if auth_error or not user or user.get("uid") == "anonymous":
                status_code, message = auth_error or (401, "Login dengan Google diperlukan.")
                return self.send_json(status_code, {"error": message, "error_type": "authentication_required"})
            return self.send_json(200, load_user_store(user["uid"]))
        if route == "/": route = "/chatbot.html"
        target = (BASE_DIR / route.lstrip("/")).resolve()
        try: target.relative_to(BASE_DIR)
        except ValueError: return self.send_json(403, {"error": "Akses file ditolak."})
        if not target.is_file() or target.name.startswith(".user_data"): return self.send_json(404, {"error": "Halaman tidak ditemukan."})
        content_type = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
        body = target.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", f"{content_type}; charset=utf-8" if content_type.startswith("text/") else content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Permissions-Policy", "microphone=(self)")
        self.end_headers()
        self.wfile.write(body)
    def do_POST(self):
        route = self.path.split("?", 1)[0].rstrip("/") or "/"
        if route not in ("/api/chat", "/api/check-prompt", "/api/user-data", "/api/transcribe", "/api/tts"): return self.send_json(404, {"error": "Endpoint tidak ditemukan."})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_BODY: return self.send_json(413, {"error": "Permintaan kosong atau terlalu besar. Gunakan dokumen maksimal 10 MB dan gambar maksimal 5 MB."})
            body = json.loads(self.rfile.read(length).decode("utf-8"))

            if route == "/api/tts":
                import urllib.parse
                raw_text = str(body.get("text") or "").strip()[:1200]
                lang = str(body.get("lang") or "id").split("-")[0].strip().lower() or "id"
                if not raw_text:
                    return self.send_json(400, {"error": "Teks suara kosong."})
                chunks = []
                words = raw_text.split()
                cur = ""
                for w in words:
                    if len(cur) + len(w) + 1 <= 180:
                        cur = f"{cur} {w}".strip()
                    else:
                        if cur: chunks.append(cur)
                        cur = w[:180]
                if cur: chunks.append(cur)
                mp3_parts = []
                try:
                    for ch in chunks[:8]:
                        q = urllib.parse.quote(ch)
                        tts_url = f"https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl={lang}&q={q}"
                        req = urllib.request.Request(tts_url, headers={"User-Agent": "Mozilla/5.0"})
                        with urllib.request.urlopen(req, timeout=10) as resp:
                            mp3_parts.append(resp.read())
                    merged_mp3 = b"".join(mp3_parts)
                    b64_mp3 = base64.b64encode(merged_mp3).decode("ascii")
                    return self.send_json(200, {"audio": f"data:audio/mpeg;base64,{b64_mp3}"})
                except Exception as exc:
                    return self.send_json(502, {"error": f"Gagal membuat suara TTS: {exc}"})

            if route == "/api/transcribe":
                import io
                import speech_recognition as sr
                raw_audio = body.get("audio", "")
                lang = str(body.get("lang") or "id-ID").strip() or "id-ID"
                if not isinstance(raw_audio, str) or not raw_audio:
                    return self.send_json(400, {"error": "Data suara kosong."})
                if "," in raw_audio and raw_audio.startswith("data:"):
                    raw_audio = raw_audio.split(",", 1)[1]
                try:
                    wav_bytes = base64.b64decode(raw_audio)
                except Exception:
                    return self.send_json(400, {"error": "Format audio base64 tidak valid."})
                recognizer = sr.Recognizer()
                try:
                    with sr.AudioFile(io.BytesIO(wav_bytes)) as source:
                        audio_data = recognizer.record(source)
                    text = recognizer.recognize_google(audio_data, language=lang)
                    return self.send_json(200, {"text": (text or "").strip()})
                except sr.UnknownValueError:
                    return self.send_json(200, {"text": ""})
                except sr.RequestError as exc:
                    return self.send_json(502, {"error": f"Layanan pengenalan suara sedang sibuk: {exc}"})
                except Exception as exc:
                    return self.send_json(400, {"error": f"Audio tidak dapat diproses: {exc}"})

            user, auth_error = verify_firebase_token(self.headers.get("Authorization", ""))
            if auth_error:
                status_code, message = auth_error
                return self.send_json(status_code, {"error": message, "error_type": "authentication_required"})

            if route == "/api/user-data":
                if not user or user.get("uid") == "anonymous":
                    return self.send_json(401, {"error": "Login dengan Google diperlukan.", "error_type": "authentication_required"})
                save_user_store(user["uid"], chats=body.get("chats"), settings=body.get("settings"))
                return self.send_json(200, {"ok": True})

            api_key = get_api_key()
            if not api_key or api_key.lower() in ("your_api_key_here", "isi_api_key_di_sini", "api_key"):
                return self.send_json(500, {"error": "API key belum dikonfigurasi. Isi file Api.key atau atur environment variable OPENROUTER_API_KEY.", "error_type": "missing_api_key"})

            text_models = [TEXT_MODEL, NEMOTRON_ULTRA_FREE, "nvidia/nemotron-3.5-lightning:free", "openrouter/free", NEMOTRON_ULTRA_PAID]

            if route == "/api/check-prompt":
                prompt = body.get("prompt", "")
                if not isinstance(prompt, str) or not prompt.strip(): return self.send_json(400, {"error": "Tulis prompt yang ingin diperiksa."})
                if len(prompt) > 12000: return self.send_json(413, {"error": "Prompt terlalu panjang untuk diperiksa (maksimal 12.000 karakter)."})
                instruction = """Anda adalah auditor prompt yang teliti, adil, dan tidak mengada-ada. Tujuanmu membantu pengguna memperbaiki prompt, bukan menghakimi gaya bahasa.
Aturan:
1. Pahami tujuan prompt secara keseluruhan sebelum menilai.
2. Jangan menandai prompt hanya karena pendek, santai, memakai bahasa gaul, campuran bahasa, nama orang/produk, istilah teknis, atau ide kreatif.
3. Beri isu hanya jika ada bukti spesifik yang bisa ditunjuk pada teks.
4. typo: salah eja yang cukup pasti. Jangan mengubah kata tidak baku jika jelas disengaja.
5. ambiguous: hanya jika ada dua atau lebih tafsir yang masuk akal dan itu dapat mengubah hasil. Kutip bagian tepat yang menyebabkan tafsir ganda.
6. context_missing: hanya jika informasi yang benar-benar diperlukan untuk memenuhi tujuan tidak ada. Jangan menganggap preferensi opsional sebagai kekurangan wajib. Untuk isu ini, kutip bagian teks yang relevan jika ada; jika tidak ada kutipan yang layak, jangan membuat isu context_missing.
7. Saran typo harus berupa penggantian singkat yang mempertahankan maksud. Untuk ambigu, berikan versi kalimat yang lebih jelas atau pertanyaan klarifikasi spesifik. Untuk konteks kurang, suggestion harus berupa pertanyaan/placeholder yang membantu, bukan mengganti seluruh prompt dengan teks yang tak relevan.
8. Jangan membuat kutipan, fakta, maksud, atau kesalahan yang tidak ada. Jangan menyarankan perubahan yang mengubah makna.
9. Prioritaskan paling banyak 8 isu penting, tanpa duplikasi. Jika tidak ada masalah nyata, kembalikan issues kosong dan overall "clear".
10. Balas HANYA JSON valid dengan bentuk {"overall":"clear atau needs_review","summary":"penjelasan singkat bahasa Indonesia","issues":[{"text":"kutipan persis dari prompt","suggestion":"saran","type":"typo atau ambiguous atau context_missing","reason":"alasan spesifik singkat"}]}.
PROMPT UNTUK DIPERIKSA:
""" + prompt
                check_messages = [
                    {"role": "system", "content": "Anda melakukan audit kualitas prompt secara konservatif. Jangan mengada-ada isu. Balas hanya JSON valid sesuai skema yang diminta."},
                    {"role": "user", "content": instruction},
                ]
                status, result, content, _ = call_ai_completion(
                    api_key,
                    text_models,
                    check_messages,
                    temperature=0.1,
                    reasoning_effort="none",
                    use_web_plugin=False,
                    title="JAFN AI Prompt Checker",
                )
                if status >= 400 or not content:
                    err = result.get("error", {}) if isinstance(result, dict) else {}
                    msg = err.get("message", str(err)) if isinstance(err, dict) else str(err)
                    low = msg.lower()
                    if status == 402 or "credit" in low:
                        return self.send_json(402, {"error": "Kredit API habis. Periksa saldo OpenRouter.", "error_type": "credits_exhausted"})
                    if status == 429 or "rate limit" in low:
                        return self.send_json(429, {"error": "Model AI sedang dibatasi. Coba lagi sebentar.", "error_type": "rate_limit"})
                    return self.send_json(502, {"error": f"Pemeriksaan AI gagal: {msg[:200] or 'Periksa model atau API key di server.'}"})

                content = content.strip()
                if content.startswith("```"):
                    content = content.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
                json_match = re.search(r"\{[\s\S]*\}", content)
                if json_match:
                    content = json_match.group(0)
                try:
                    parsed = json.loads(content)
                except json.JSONDecodeError:
                    return self.send_json(502, {"error": "AI mengirim format pemeriksaan yang tidak terbaca. Coba lagi."})
                issues = parsed.get("issues", []) if isinstance(parsed, dict) else []
                safe = []
                if isinstance(issues, list):
                    for item in issues[:8]:
                        if not isinstance(item, dict): continue
                        quoted = item.get("text")
                        suggestion = item.get("suggestion")
                        if isinstance(quoted, str) and quoted and quoted in prompt and isinstance(suggestion, str):
                            kind = str(item.get("type", "ambiguous"))
                            if kind not in ("typo", "ambiguous", "context_missing"): kind = "ambiguous"
                            safe.append({"text": quoted, "suggestion": suggestion[:500], "type": kind, "reason": str(item.get("reason", "Periksa bagian ini."))[:300]})
                return self.send_json(200, {
                    "issues": safe,
                    "overall": str(parsed.get("overall", "needs_review")) if isinstance(parsed, dict) else "needs_review",
                    "summary": str(parsed.get("summary", "Pemeriksaan selesai."))[:300] if isinstance(parsed, dict) else "Pemeriksaan selesai.",
                    "source": "ai"
                })

            messages = body.get("messages", [])
            image = body.get("image")
            personality = body.get("personality", "friendly")
            personality_instructions = {
                "friendly": "Gunakan kepribadian ramah, hangat, suportif, dan natural. Sapa dengan wajar, jangan berlebihan.",
                "casual": "Gunakan kepribadian santai dan akrab, bahasa Indonesia sehari-hari yang sopan, ringkas, dan tidak kaku.",
                "professional": "Gunakan kepribadian profesional: jelas, terstruktur, sopan, akurat, dan hindari slang atau emoji berlebihan."
            }
            style_instruction = personality_instructions.get(personality, personality_instructions["friendly"])
            if not isinstance(messages, list): return self.send_json(400, {"error": "Format riwayat percakapan tidak valid."})
            clean = [{
                "role": "system",
                "content": (
                    SYSTEM_PROMPT + " " + style_instruction +
                    " GAYA JAWABAN: jawab alami seperti ChatGPT, langsung ke inti, dan ringkas untuk pertanyaan sederhana (biasanya 1–3 kalimat). "
                    "Jangan mengulang pertanyaan, jangan memberi pembukaan panjang atau daftar yang tidak diperlukan. "
                    "Uraikan panjang hanya jika pengguna meminta detail atau tugas memang kompleks. "
                    "FORMAT SECARA KONTEKSTUAL: utamakan teks biasa yang natural. Gunakan Markdown hanya jika benar-benar membantu isi jawaban: "
                    "bold untuk menegaskan kata penting, daftar jika ada beberapa langkah/poin, heading hanya untuk jawaban panjang yang punya beberapa bagian, "
                    "tabel hanya untuk membandingkan data yang memang cocok ditabelkan. Jangan menambahkan garis pemisah (---, ***) sebagai hiasan, "
                    "jangan menulis pembungkus matematika $$...$$, jangan memakai simbol/format dekoratif atau LaTeX jika tidak diperlukan. "
                    "Untuk rumus yang memang diminta, tulis rumus dengan simbol biasa yang mudah dibaca tanpa pembungkus $$; jika pengguna meminta format khusus, ikuti permintaan itu. "
                    "Jangan pernah menampilkan penanda Markdown mentah seperti **, $$, atau garis pemisah sebagai baris tersendiri. "
                    "Jika membuat daftar, gunakan bullet (-) untuk beberapa poin setara dan angka (1., 2., 3.) untuk langkah berurutan; jangan gunakan tanda kutip Markdown (>) sebagai pengganti daftar. "
                    "Jangan menulis entitas HTML seperti &#x20; secara literal. Gunakan *teks* untuk miring hanya bila perlu dan jangan menambahkan garis miring terbalik sebelum tanda format. "
                    "Jawab seperti percakapan ChatGPT: ringkas untuk hal sederhana, lebih terperinci hanya jika diperlukan. Jangan berlebihan memakai emoji atau sapaan Tuanku. "
                    "Jangan mengubah fakta, mengarang informasi, atau mengabaikan permintaan pengguna."
                )
            }]
            for item in messages[-24:]:
                if not isinstance(item, dict) or item.get("role") not in ("user", "assistant"): continue
                content = item.get("content", "")
                if isinstance(content, str): clean.append({"role": item["role"], "content": content[:110000]})
            if len(clean) == 1: return self.send_json(400, {"error": "Tulis pesan terlebih dahulu."})
            if image:
                if not isinstance(image, str) or not image.startswith("data:image/") or len(image) > 7 * 1024 * 1024:
                    return self.send_json(400, {"error": "Format gambar tidak didukung atau ukurannya terlalu besar."})
                last_user = next((m for m in reversed(clean) if m["role"] == "user"), None)
                if last_user:
                    txt = last_user["content"] if isinstance(last_user["content"], str) else "Jelaskan gambar ini."
                    last_user["content"] = [{"type": "text", "text": txt or "Jelaskan gambar ini."}, {"type": "image_url", "image_url": {"url": image}}]

            if ENABLE_WEB_SEARCH:
                clean[0]["content"] += "\n\nJika hasil pencarian web real-time tersedia pada request ini, prioritaskan sumber tepercaya dan sertakan tautan sumber relevan."

            chosen_models = [VISION_MODEL, "nvidia/nemotron-3.5-super-vl:free", "openrouter/free"] if image else text_models
            status, result, reply, retry_after = call_ai_completion(
                api_key,
                chosen_models,
                clean,
                max_tokens=1024 if image else None,
                reasoning_effort=None,
                use_web_plugin=ENABLE_WEB_SEARCH,
                title="JAFN AI",
            )
            if status >= 400 or not reply:
                err = result.get("error", {}) if isinstance(result, dict) else {}
                message = err.get("message", str(err)) if isinstance(err, dict) else str(err)
                low = message.lower()
                if status == 402 or "insufficient credits" in low or "credit balance" in low:
                    return self.send_json(402, {"error": "Kredit atau batas pengeluaran OpenRouter tidak mencukupi. Periksa https://openrouter.ai/settings/credits.", "error_type": "credits_exhausted"})
                if status == 429 or "rate limit" in low or "too many requests" in low:
                    try: seconds = max(1, min(3600, int(float(retry_after)))) if retry_after else 60
                    except (TypeError, ValueError): seconds = 60
                    return self.send_json(429, {"error": f"Model sedang terkena batas permintaan. Coba lagi dalam {seconds} detik.", "error_type": "rate_limit", "retry_after_seconds": seconds})
                if status == 401 or "invalid api key" in low or "user not found" in low or "no auth credentials" in low:
                    masked = (api_key[:12] + "..." + api_key[-4:]) if len(api_key) > 16 else "kosong"
                    return self.send_json(401, {"error": f"API key ({masked}) ditolak oleh OpenRouter ({message}). Pastikan Environment Variable OPENROUTER_API_KEY di Vercel diisi dengan key terbaru lalu klik Redeploy.", "error_type": "invalid_api_key"})
                if "data policy" in low or "privacy" in low:
                    return self.send_json(400, {"error": "Model gratis memerlukan izin Data Policy di OpenRouter. Aktifkan 'Enable free endpoints' di https://openrouter.ai/settings/privacy lalu coba lagi."})
                if status == 503 or "unavailable" in low:
                    return self.send_json(503, {"error": "Model Nemotron 3 Ultra sedang sibuk/tidak tersedia. Coba lagi beberapa saat lagi.", "error_type": "provider_unavailable", "retry_after_seconds": 60})
                if not reply and status < 400:
                    return self.send_json(502, {"error": "Model tidak mengirim jawaban. Coba lagi."})
                return self.send_json(status if 400 <= status < 600 else 502, {"error": f"OpenRouter API error: {message[:500]}"})

            return self.send_json(200, {"reply": reply})
        except (json.JSONDecodeError, UnicodeDecodeError, ValueError): return self.send_json(400, {"error": "Format permintaan tidak valid."})
        except Exception: return self.send_json(500, {"error": "Terjadi kesalahan internal. Coba lagi."})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "3000"))
    server = http.server.ThreadingHTTPServer(("0.0.0.0", port), ChatHandler)
    print(f"JAFN AI (Nemotron 3 Ultra) berjalan pada http://localhost:{port}")
    server.serve_forever()
