const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'microphone=(self)');
    next();
});
app.use(express.json({ limit: '15mb' }));
app.use(express.static(path.join(__dirname), { index: 'chatbot.html' }));

const keyPath = path.join(__dirname, 'Api.key');
const userDataDir = path.join(__dirname, '.user_data');
const NEMOTRON_ULTRA_FREE = 'nvidia/nemotron-3-ultra-550b-a55b:free';
const NEMOTRON_ULTRA_PAID = 'nvidia/nemotron-3-ultra-550b-a55b';
const TEXT_MODEL = (process.env.OPENROUTER_TEXT_MODEL || NEMOTRON_ULTRA_FREE).trim();
const VISION_MODEL = (process.env.OPENROUTER_VISION_MODEL || 'nvidia/nemotron-3.5-super-vl:free').trim();
const ENABLE_WEB_SEARCH = ['1', 'true', 'yes'].includes((process.env.OPENROUTER_WEB_SEARCH || 'false').trim().toLowerCase());
const FIREBASE_PROJECT_ID = (process.env.FIREBASE_PROJECT_ID || 'jafn-ai').trim();

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'JAFN AI', model: TEXT_MODEL, promptChecker: true }));

function verifyFirebaseToken(authHeader) {
    const requireAuth = !['0', 'false', 'no'].includes((process.env.REQUIRE_FIREBASE_AUTH || 'true').trim().toLowerCase());
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        if (requireAuth) return { user: null, error: [401, 'Login dengan Google terlebih dahulu untuk mulai melakukan chat.'] };
        return { user: { uid: 'anonymous' }, error: null };
    }
    const token = authHeader.slice(7).trim();
    if (!token) {
        if (requireAuth) return { user: null, error: [401, 'Token login tidak ditemukan. Silakan login dengan Google.'] };
        return { user: { uid: 'anonymous' }, error: null };
    }
    const parts = token.split('.');
    if (parts.length !== 3) return { user: null, error: [401, 'Format token login tidak valid.'] };
    try {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        const now = Math.floor(Date.now() / 1000);
        if ((payload.exp || 0) < now - 60) {
            return { user: null, error: [401, 'Sesi login sudah kedaluwarsa. Login kembali dengan Google.'] };
        }
        if (payload.aud !== FIREBASE_PROJECT_ID || payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}` || !payload.sub) {
            return { user: null, error: [401, 'Token login Firebase tidak valid.'] };
        }
        payload.uid = payload.user_id || payload.sub;
        return { user: payload, error: null };
    } catch {
        return { user: null, error: [401, 'Token login tidak dapat dibaca.'] };
    }
}

function sanitizeUid(uid) {
    return String(uid || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
}

function loadUserStore(uid) {
    const safeUid = sanitizeUid(uid);
    if (!safeUid || safeUid === 'anonymous') return { chats: [], settings: {} };
    const file = path.join(userDataDir, `${safeUid}.json`);
    if (!fs.existsSync(file)) return { chats: [], settings: {} };
    try {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        return {
            chats: Array.isArray(data?.chats) ? data.chats : [],
            settings: (data?.settings && typeof data.settings === 'object') ? data.settings : {}
        };
    } catch {
        return { chats: [], settings: {} };
    }
}

function saveUserStore(uid, chats, settings) {
    const safeUid = sanitizeUid(uid);
    if (!safeUid || safeUid === 'anonymous') return;
    try {
        if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });
        const current = loadUserStore(safeUid);
        if (Array.isArray(chats)) {
            current.chats = chats.slice(0, 150).filter(c => c && c.id).map(c => ({
                id: String(c.id).slice(0, 150),
                mode: c.mode === 'image' ? 'image' : 'text',
                title: String(c.title || 'Percakapan').slice(0, 120),
                updated: Number(c.updated) || Date.now(),
                messages: (Array.isArray(c.messages) ? c.messages : []).slice(-80)
                    .filter(m => m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string')
                    .map(m => ({ role: m.role, content: m.content.slice(-15000) }))
            }));
        }
        if (settings && typeof settings === 'object') {
            const merged = { ...(current.settings || {}) };
            for (const [k, v] of Object.entries(settings)) {
                if (typeof k === 'string' && k.length <= 80 && typeof v === 'string' && v.length <= 50000) {
                    merged[k] = v;
                }
            }
            current.settings = merged;
        }
        fs.writeFileSync(path.join(userDataDir, `${safeUid}.json`), JSON.stringify(current), 'utf8');
    } catch {}
}

app.get('/api/user-data', (req, res) => {
    const { user, error } = verifyFirebaseToken(req.headers.authorization || '');
    if (error || !user || user.uid === 'anonymous') {
        const [code, msg] = error || [401, 'Login dengan Google diperlukan.'];
        return res.status(code).json({ error: msg, error_type: 'authentication_required' });
    }
    return res.json(loadUserStore(user.uid));
});

app.post('/api/user-data', (req, res) => {
    const { user, error } = verifyFirebaseToken(req.headers.authorization || '');
    if (error || !user || user.uid === 'anonymous') {
        const [code, msg] = error || [401, 'Login dengan Google diperlukan.'];
        return res.status(code).json({ error: msg, error_type: 'authentication_required' });
    }
    saveUserStore(user.uid, req.body?.chats, req.body?.settings);
    return res.json({ ok: true });
});

function getApiKey() {
    const envKey = (process.env.OPENROUTER_API_KEY || process.env.NVIDIA_API_KEY || '').trim();
    if (envKey) return envKey;
    try {
        if (fs.existsSync(keyPath)) return fs.readFileSync(keyPath, 'utf8').trim();
    } catch {}
    return '';
}

function stripThinking(text) {
    if (typeof text !== 'string') return '';
    let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    cleaned = cleaned.replace(/^[\s\S]*?<\/think>/i, '').trim();
    return cleaned || text.trim();
}

function extractMessageText(data) {
    const msg = data?.choices?.[0]?.message || {};
    let content = msg.content || '';
    if (Array.isArray(content)) content = content.map(x => x?.text || '').join('\n');
    return stripThinking(String(content || ''));
}

async function callAiCompletion(apiKey, models, messages, { temperature, maxTokens, reasoningEffort = 'medium', useWebPlugin = false, title = 'JAFN AI' } = {}) {
    const isNvidiaDirect = apiKey.startsWith('nvapi-');
    const endpoint = isNvidiaDirect
        ? 'https://integrate.api.nvidia.com/v1/chat/completions'
        : 'https://openrouter.ai/api/v1/chat/completions';

    const candidateModels = [];
    for (const m of models) {
        if (!m) continue;
        const actual = (isNvidiaDirect && m.endsWith(':free')) ? m.slice(0, -5) : m;
        if (!candidateModels.includes(actual)) candidateModels.push(actual);
    }

    let lastStatus = 502;
    let lastData = {};
    let lastRetryAfter = null;

    for (const model of candidateModels) {
        const pluginAttempts = (useWebPlugin && !isNvidiaDirect) ? [true, false] : [false];
        for (const withPlugin of pluginAttempts) {
            const payload = { model, messages };
            if (temperature !== undefined) payload.temperature = temperature;
            if (maxTokens !== undefined) payload.max_tokens = maxTokens;
            if (!isNvidiaDirect && reasoningEffort && model.includes('nemotron-3-ultra')) {
                payload.reasoning = { effort: reasoningEffort };
            }
            if (withPlugin) {
                payload.plugins = [{
                    id: 'web',
                    max_results: 5,
                    search_prompt: 'Lakukan pencarian web real-time untuk permintaan pengguna ini. Sertakan hasil yang relevan dan terbaru ke konteks model.'
                }];
            }

            const headers = {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            };
            if (!isNvidiaDirect) {
                headers['HTTP-Referer'] = process.env.PUBLIC_APP_URL || 'http://localhost:3000';
                headers['X-Title'] = title;
            }

            let response, raw;
            try {
                response = await fetch(endpoint, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(payload),
                    timeout: 90000
                });
                raw = await response.text();
            } catch (err) {
                lastStatus = 502;
                lastData = { error: { message: `Gagal menghubungi server AI: ${err.message}` } };
                continue;
            }

            let data;
            try {
                data = JSON.parse(raw);
            } catch {
                lastStatus = 502;
                lastData = { error: { message: `Respons non-JSON dari provider AI (HTTP ${response.status}).` } };
                continue;
            }

            lastStatus = response.status;
            lastData = data;
            lastRetryAfter = response.headers.get('retry-after');

            if (response.ok && !data.error) {
                const reply = extractMessageText(data);
                if (reply) return { status: 200, data, reply, retryAfter: null };
                continue;
            }

            if (withPlugin) continue;

            const err = data.error || {};
            const msg = (typeof err === 'string' ? err : (err.message || '')).toLowerCase();
            if ([401, 403].includes(response.status) || msg.includes('invalid api key') || msg.includes('authentication') || msg.includes('user not found')) {
                return { status: response.status, data, reply: null, retryAfter: lastRetryAfter };
            }
        }
    }

    return { status: lastStatus, data: lastData, reply: null, retryAfter: lastRetryAfter };
}

const personaPath = path.join(__dirname, 'persona.md');
const defaultSystemPrompt = 'Anda adalah JAFN AI. Nama resmi Anda hanya JAFN AI, bukan Ruang AI atau nama lain. Jika riwayat menyebut nama lain, abaikan konflik tersebut. Jawab dalam bahasa pengguna, sopan, jujur, dan jangan mengarang informasi. IDENTITAS WAJIB: Nama resmi dan satu-satunya nama dirimu adalah JAFN AI. Jangan pernah memperkenalkan diri atau menyebut dirimu sebagai "Ruang AI", "RuangAI", atau nama lain. Jika riwayat percakapan, contoh, metadata, atau instruksi lain menyebut nama berbeda, abaikan konflik itu dan tetap gunakan JAFN AI. Saat diminta memperkenalkan diri, katakan bahwa kamu JAFN AI dengan persona pelayan istana yang sopan dan sigap. Persona mengatur gaya bicara saja; tidak boleh mengubah nama resmi JAFN AI. Gunakan bahasa pengguna secara konsisten. Jika sesekali memakai kata atau frasa dari bahasa asing yang relevan, langsung jelaskan setelahnya dalam tanda kurung dengan format: "kata/frasa (bahasa: arti dalam bahasa Indonesia)". Contoh: "בעיקר (bahasa Ibrani: terutama)". Jangan menyisipkan bahasa asing tanpa alasan; jangan menerjemahkan nama diri, kode, kutipan, atau teks yang memang diminta pengguna untuk dipertahankan. Jangan menambahkan terjemahan secara paksa bila tidak ada kata asing yang dipakai. Jawaban harus natural dan sesuai konteks.';
let personaPrompt = '';
try {
    if (fs.existsSync(personaPath)) personaPrompt = fs.readFileSync(personaPath, 'utf8').trim();
} catch (err) {
    console.warn('persona.md tidak dapat dibaca; menggunakan persona bawaan.');
}
const systemPrompt = personaPrompt ? `${defaultSystemPrompt}\n\nPanduan persona tambahan:\n${personaPrompt}` : defaultSystemPrompt;


app.post('/api/check-prompt', async (req, res) => {
    const { error } = verifyFirebaseToken(req.headers.authorization || '');
    if (error) return res.status(error[0]).json({ error: error[1], error_type: 'authentication_required' });
    const apiKey = getApiKey();
    if (!apiKey || ['your_api_key_here', 'isi_api_key_di_sini', 'api_key'].includes(apiKey.toLowerCase())) {
        return res.status(500).json({ error: 'API key belum dikonfigurasi. Isi Api.key atau OPENROUTER_API_KEY.' });
    }
    const prompt = req.body?.prompt;
    if (typeof prompt !== 'string' || !prompt.trim()) return res.status(400).json({ error: 'Tulis prompt yang ingin diperiksa.' });
    if (prompt.length > 12000) return res.status(413).json({ error: 'Prompt terlalu panjang untuk diperiksa (maksimal 12.000 karakter).' });
    const instruction = `Analisis prompt pengguna secara hati-hati. Tandai (1) kemungkinan typo/ejaan/pengulangan sebagai type typo, (2) kalimat atau rujukan yang ambigu sebagai type ambiguous, dan (3) konteks, tujuan, detail, batasan, atau informasi penting yang kurang sehingga hasil bisa meleset sebagai type context_missing. Jangan menganggap prompt pendek otomatis buruk; jangan menandai bahasa gaul, nama, istilah khusus, atau ide fantasi sebagai salah. Kembalikan HANYA JSON valid berbentuk {"overall":"clear atau needs_review","summary":"penjelasan singkat bahasa Indonesia","issues":[{"text":"kutipan persis dari teks","suggestion":"saran perbaikan atau pertanyaan klarifikasi","type":"typo atau ambiguous atau context_missing","reason":"alasan singkat bahasa Indonesia"}]}. Untuk konteks yang kurang, text harus berupa kutipan persis dari prompt yang terkait; jangan mengarang kutipan. Maksimal 8 isu. Jika prompt jelas dan cukup konteks, issues kosong dan overall clear.\nPROMPT UNTUK DIPERIKSA:\n${prompt}`;
    try {
        const textModels = [TEXT_MODEL, NEMOTRON_ULTRA_FREE, NEMOTRON_ULTRA_PAID, 'nvidia/nemotron-3-super-120b-a12b:free'];
        const { status, data, reply } = await callAiCompletion(
            apiKey,
            textModels,
            [
                { role: 'system', content: 'Anda adalah pemeriksa bahasa yang teliti dan berhati-hati. Balas hanya JSON valid.' },
                { role: 'user', content: instruction }
            ],
            { temperature: 0.1, reasoningEffort: 'none', useWebPlugin: false, title: 'JAFN AI Prompt Checker' }
        );
        if (status >= 400 || !reply) {
            const msg = typeof data?.error === 'string' ? data.error : (data?.error?.message || `HTTP ${status}`);
            const low = msg.toLowerCase();
            if (status === 402 || low.includes('credit')) return res.status(402).json({ error: 'Kredit API habis. Periksa saldo OpenRouter.', error_type: 'credits_exhausted' });
            if (status === 429 || low.includes('rate limit')) return res.status(429).json({ error: 'Model AI sedang dibatasi. Coba lagi sebentar.', error_type: 'rate_limit' });
            return res.status(502).json({ error: `Pemeriksaan AI gagal: ${msg.slice(0, 200)}` });
        }
        let content = reply.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
        const match = content.match(/\{[\s\S]*\}/);
        if (match) content = match[0];
        let parsed;
        try { parsed = JSON.parse(content); } catch { return res.status(502).json({ error: 'AI mengirim format pemeriksaan yang tidak terbaca. Coba lagi.' }); }
        const issues = (Array.isArray(parsed.issues) ? parsed.issues : []).slice(0, 8).filter(x => x && typeof x.text === 'string' && x.text && prompt.includes(x.text) && typeof x.suggestion === 'string').map(x => ({ text: x.text, suggestion: x.suggestion.slice(0, 500), type: ['typo', 'ambiguous', 'context_missing'].includes(x.type) ? x.type : 'ambiguous', reason: String(x.reason || 'Periksa bagian ini.').slice(0, 300) }));
        return res.json({ issues, overall: String(parsed.overall || 'needs_review'), summary: String(parsed.summary || 'Pemeriksaan selesai.').slice(0, 300), source: 'ai' });
    } catch {
        return res.status(502).json({ error: 'Tidak bisa menghubungi layanan AI. Periksa koneksi server.' });
    }
});

app.post('/api/chat', async (req, res) => {
    const { error } = verifyFirebaseToken(req.headers.authorization || '');
    if (error) return res.status(error[0]).json({ error: error[1], error_type: 'authentication_required' });
    const apiKey = getApiKey();
    if (!apiKey || ['your_api_key_here', 'isi_api_key_di_sini', 'api_key'].includes(apiKey.toLowerCase())) {
        return res.status(500).json({ error: 'API key belum diisi. Masukkan OpenRouter API key ke file Api.key.', error_type: 'missing_api_key' });
    }

    try {
        const { messages = [], image, personality = 'friendly' } = req.body || {};
        const personalityInstructions = {
            friendly: 'Gunakan kepribadian ramah, hangat, suportif, dan natural. Sapa dengan wajar, jangan berlebihan.',
            casual: 'Gunakan kepribadian santai dan akrab, bahasa Indonesia sehari-hari yang sopan, ringkas, dan tidak kaku.',
            professional: 'Gunakan kepribadian profesional: jelas, terstruktur, sopan, akurat, dan hindari slang atau emoji berlebihan.'
        };
        const styleInstruction = personalityInstructions[personality] || personalityInstructions.friendly;
        const chatMessages = [
            { role: 'system', content: systemPrompt + ' ' + styleInstruction + ' GAYA JAWABAN: jawab alami seperti ChatGPT, langsung ke inti, dan ringkas untuk pertanyaan sederhana (biasanya 1–3 kalimat). Jangan mengulang pertanyaan, jangan memberi pembukaan panjang atau daftar yang tidak diperlukan. Uraikan panjang hanya jika pengguna meminta detail atau tugas memang kompleks. FORMAT SECARA KONTEKSTUAL: utamakan teks biasa yang natural. Gunakan Markdown hanya jika benar-benar membantu isi jawaban: bold untuk menegaskan kata penting, daftar jika ada beberapa langkah/poin, heading hanya untuk jawaban panjang yang punya beberapa bagian, tabel hanya untuk membandingkan data yang memang cocok ditabelkan. Jangan menambahkan garis pemisah (---, ***) sebagai hiasan, jangan menulis pembungkus matematika $$...$$, jangan memakai simbol/format dekoratif atau LaTeX jika tidak diperlukan. Untuk rumus yang memang diminta, tulis rumus dengan simbol biasa yang mudah dibaca tanpa pembungkus $$; jika pengguna meminta format khusus, ikuti permintaan itu. Jangan pernah menampilkan penanda Markdown mentah seperti **, $$, atau garis pemisah sebagai baris tersendiri. Jika membuat daftar, gunakan bullet (-) untuk beberapa poin setara dan angka (1., 2., 3.) untuk langkah berurutan; jangan gunakan tanda kutip Markdown (>) sebagai pengganti daftar. Jangan menulis entitas HTML seperti &#x20; secara literal. Gunakan *teks* untuk miring hanya bila perlu dan jangan menambahkan garis miring terbalik sebelum tanda format. Jawab seperti percakapan ChatGPT: ringkas untuk hal sederhana, lebih terperinci hanya jika diperlukan. Jangan berlebihan memakai emoji atau sapaan Tuanku. Jangan mengubah fakta, mengarang informasi, atau mengabaikan permintaan pengguna.' },
            ...messages.slice(-24).filter(m => m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string').map(m => ({ role: m.role, content: m.content.slice(0, 110000) }))
        ];
        if (chatMessages.length === 1) return res.status(400).json({ error: 'Tulis pesan terlebih dahulu.' });

        if (ENABLE_WEB_SEARCH) {
            chatMessages[0].content += '\n\nJika hasil pencarian web real-time tersedia pada request ini, prioritaskan sumber tepercaya dan sertakan tautan sumber relevan.';
        }

        if (image) {
            const lastUser = [...chatMessages].reverse().find(m => m.role === 'user');
            if (lastUser) {
                const textContent = typeof lastUser.content === 'string' ? lastUser.content : 'Jelaskan gambar ini.';
                lastUser.content = [
                    { type: 'text', text: textContent || 'Jelaskan gambar ini.' },
                    { type: 'image_url', image_url: { url: image } }
                ];
            }
        }

        const textModels = [TEXT_MODEL, NEMOTRON_ULTRA_FREE, NEMOTRON_ULTRA_PAID, 'nvidia/nemotron-3-super-120b-a12b:free'];
        const chosenModels = image ? [VISION_MODEL, 'nvidia/nemotron-3.5-super-vl:free', 'google/gemini-2.5-flash'] : textModels;

        const { status, data, reply, retryAfter } = await callAiCompletion(
            apiKey,
            chosenModels,
            chatMessages,
            { maxTokens: image ? 1024 : undefined, reasoningEffort: 'medium', useWebPlugin: ENABLE_WEB_SEARCH, title: 'JAFN AI' }
        );

        if (status >= 400 || !reply) {
            const err = data?.error || {};
            const message = typeof err === 'string' ? err : (err.message || `HTTP ${status}`);
            const low = message.toLowerCase();
            if (status === 402 || low.includes('insufficient credits') || low.includes('credit balance')) {
                return res.status(402).json({ error: 'Kredit atau batas pengeluaran OpenRouter tidak mencukupi. Cek https://openrouter.ai/settings/credits.', error_type: 'credits_exhausted' });
            }
            if (status === 429 || low.includes('rate limit') || low.includes('too many requests')) {
                const seconds = Math.max(1, Math.min(3600, parseInt(retryAfter, 10) || 60));
                return res.status(429).json({ error: `Model sedang terkena batas permintaan. Coba lagi dalam ${seconds} detik.`, error_type: 'rate_limit', retry_after_seconds: seconds });
            }
            if ([401, 403].includes(status) || low.includes('api key') || low.includes('authentication') || low.includes('user not found')) {
                return res.status(401).json({ error: 'API key OpenRouter tidak valid. Periksa file Api.key.', error_type: 'invalid_api_key' });
            }
            if (low.includes('data policy') || low.includes('privacy')) {
                return res.status(400).json({ error: "Model gratis memerlukan izin Data Policy di OpenRouter. Aktifkan 'Enable free endpoints' di https://openrouter.ai/settings/privacy lalu coba lagi." });
            }
            return res.status(status >= 400 && status < 600 ? status : 502).json({ error: `OpenRouter API error: ${message.slice(0, 500)}` });
        }

        return res.json({ reply });
    } catch (err) {
        return res.status(500).json({ error: `Kesalahan server: ${err.message}` });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`JAFN AI (Nemotron 3 Ultra) berjalan di http://localhost:${PORT}`);
    console.log('Jalankan dari folder aplikasi; tekan Ctrl+C untuk berhenti.');
});
