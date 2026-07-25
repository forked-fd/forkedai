// ═══════════════════════════════════════════════════════════════
// Forked AI — Configuration & Multi-Provider Key Management
// ═══════════════════════════════════════════════════════════════
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

// ─── Helpers ─────────────────────────────────────────────────

function clamp(value, min, max, fallback) {
  const num = Number(value);
  if (Number.isNaN(num)) return fallback;
  return Math.min(Math.max(num, min), max);
}

/**
 * Parse comma-separated API keys from env variable.
 * Filters out empty strings and trims whitespace.
 */
function parseKeys(envVar) {
  if (!envVar) return [];
  return envVar
    .split(',')
    .map(k => k.trim())
    .filter(Boolean);
}

// ─── Multi-Provider Configuration ────────────────────────────

/**
 * Each provider has:
 *  - id: unique identifier
 *  - name: display name for logs
 *  - keys: array of API keys (round-robin)
 *  - baseUrl: API endpoint
 *  - models: array of models to try (in order)
 *  - headers: function(apiKey) => request headers
 *  - buildBody: function(messages, model, opts) => request body
 *  - parseResponse: function(json) => { content, usage }
 *  - supportsVision: whether this provider supports image input
 *  - currentKeyIndex: tracks which key to use next (round-robin)
 */
export const PROVIDERS = [];

// ── Provider 1: Groq ────────────────────────────────────────
const groqKeys = parseKeys(process.env.GROQ_API_KEYS);
if (groqKeys.length > 0) {
  PROVIDERS.push({
    id: 'groq',
    name: 'Groq',
    keys: groqKeys,
    baseUrl: 'https://api.groq.com/openai/v1',
    models: [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'gemma2-9b-it',
      'mixtral-8x7b-32768',
    ],
    supportsVision: false,
    currentKeyIndex: 0,

    getNextKey() {
      const key = this.keys[this.currentKeyIndex % this.keys.length];
      this.currentKeyIndex++;
      return key;
    },

    headers(apiKey) {
      return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      };
    },

    buildBody(messages, model, opts = {}) {
      // Filter out image content for non-vision providers
      const cleanMessages = messages.map(m => {
        if (Array.isArray(m.content)) {
          return { ...m, content: m.content.filter(p => p.type === 'text').map(p => p.text).join('\n') };
        }
        return m;
      });

      return {
        model,
        messages: cleanMessages,
        temperature: opts.temperature ?? TEMPERATURE,
        max_tokens: opts.max_tokens ?? MAX_TOKENS,
      };
    },

    parseResponse(json) {
      const choice = json?.choices?.[0];
      return {
        content: choice?.message?.content || '',
        usage: json?.usage || null,
      };
    },

    async call(messages, model, apiKey, opts) {
      const body = this.buildBody(messages, model, opts);
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.headers(apiKey),
        body: JSON.stringify(body),
      });

      const text = await response.text();

      if (!response.ok) {
        let errMsg = `Groq API error: ${response.status}`;
        try {
          const errJson = JSON.parse(text);
          errMsg = errJson?.error?.message || errMsg;
        } catch { /* ignore */ }

        const error = new Error(errMsg);
        error.status = response.status;
        throw error;
      }

      return this.parseResponse(JSON.parse(text));
    },
  });
}

// ── Provider 3: DeepSeek (Direct API) ───────────────────────
const deepseekKeys = parseKeys(process.env.DEEPSEEK_API_KEYS);
if (deepseekKeys.length > 0) {
  PROVIDERS.push({
    id: 'deepseek',
    name: 'DeepSeek',
    keys: deepseekKeys,
    baseUrl: 'https://api.deepseek.com',
    models: [
      'deepseek-chat',
      'deepseek-reasoner',
    ],
    supportsVision: false,
    currentKeyIndex: 0,

    getNextKey() {
      const key = this.keys[this.currentKeyIndex % this.keys.length];
      this.currentKeyIndex++;
      return key;
    },

    headers(apiKey) {
      return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      };
    },

    buildBody(messages, model, opts = {}) {
      const cleanMessages = messages.map(m => {
        if (Array.isArray(m.content)) {
          return { ...m, content: m.content.filter(p => p.type === 'text').map(p => p.text).join('\n') };
        }
        return m;
      });

      return {
        model,
        messages: cleanMessages,
        temperature: opts.temperature ?? TEMPERATURE,
        max_tokens: opts.max_tokens ?? MAX_TOKENS,
      };
    },

    parseResponse(json) {
      const choice = json?.choices?.[0];
      return {
        content: choice?.message?.content || '',
        usage: json?.usage || null,
      };
    },

    async call(messages, model, apiKey, opts) {
      const body = this.buildBody(messages, model, opts);
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.headers(apiKey),
        body: JSON.stringify(body),
      });

      const text = await response.text();

      if (!response.ok) {
        let errMsg = `DeepSeek API error: ${response.status}`;
        try {
          const errJson = JSON.parse(text);
          errMsg = errJson?.error?.message || errMsg;
        } catch { /* ignore */ }

        const error = new Error(errMsg);
        error.status = response.status;
        throw error;
      }

      return this.parseResponse(JSON.parse(text));
    },
  });
}

// ── Provider 4: OpenRouter ──────────────────────────────────
const openrouterKeys = parseKeys(process.env.OPENROUTER_API_KEYS);
if (openrouterKeys.length > 0) {
  PROVIDERS.push({
    id: 'openrouter',
    name: 'OpenRouter',
    keys: openrouterKeys,
    baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    models: [
      'openrouter/auto',
      'deepseek/deepseek-r1:free',
      'deepseek/deepseek-chat:free',
      'meta-llama/llama-3.3-70b-instruct:free',
      'google/gemini-2.0-flash-lite-preview-02-05:free',
      'qwen/qwen-2.5-72b-instruct:free',
    ],
    supportsVision: true,
    currentKeyIndex: 0,

    getNextKey() {
      const key = this.keys[this.currentKeyIndex % this.keys.length];
      this.currentKeyIndex++;
      return key;
    },

    headers(apiKey) {
      return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': CLIENT_URL,
        'X-Title': 'Forked AI',
      };
    },

    buildBody(messages, model, opts = {}) {
      return {
        model,
        messages,
        temperature: opts.temperature ?? TEMPERATURE,
        max_tokens: opts.max_tokens ?? MAX_TOKENS,
      };
    },

    parseResponse(json) {
      const choice = json?.choices?.[0];
      return {
        content: choice?.message?.content || '',
        usage: json?.usage || null,
      };
    },

    async call(messages, model, apiKey, opts) {
      const body = this.buildBody(messages, model, opts);
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.headers(apiKey),
        body: JSON.stringify(body),
      });

      const text = await response.text();

      if (!response.ok) {
        let errMsg = `OpenRouter API error: ${response.status}`;
        try {
          const errJson = JSON.parse(text);
          errMsg = errJson?.error?.message || errMsg;
        } catch { /* ignore */ }

        const error = new Error(errMsg);
        error.status = response.status;
        throw error;
      }

      return this.parseResponse(JSON.parse(text));
    },
  });
}

// ── Provider 5: NVIDIA NIM ──────────────────────────────────
const nvidiaKeys = parseKeys(process.env.NVIDIA_API_KEYS);
if (nvidiaKeys.length > 0) {
  PROVIDERS.push({
    id: 'nvidia',
    name: 'NVIDIA NIM',
    keys: nvidiaKeys,
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    models: [
      'nvidia/llama-3.1-nemotron-70b-instruct',
      'meta/llama-3.1-405b-instruct',
    ],
    supportsVision: false,
    currentKeyIndex: 0,

    getNextKey() {
      const key = this.keys[this.currentKeyIndex % this.keys.length];
      this.currentKeyIndex++;
      return key;
    },

    headers(apiKey) {
      return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      };
    },

    buildBody(messages, model, opts = {}) {
      const cleanMessages = messages.map(m => {
        if (Array.isArray(m.content)) {
          return { ...m, content: m.content.filter(p => p.type === 'text').map(p => p.text).join('\n') };
        }
        return m;
      });

      return {
        model,
        messages: cleanMessages,
        temperature: opts.temperature ?? TEMPERATURE,
        max_tokens: opts.max_tokens ?? MAX_TOKENS,
      };
    },

    parseResponse(json) {
      const choice = json?.choices?.[0];
      return {
        content: choice?.message?.content || '',
        usage: json?.usage || null,
      };
    },

    async call(messages, model, apiKey, opts) {
      const body = this.buildBody(messages, model, opts);
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.headers(apiKey),
        body: JSON.stringify(body),
      });

      const text = await response.text();

      if (!response.ok) {
        let errMsg = `NVIDIA API error: ${response.status}`;
        try {
          const errJson = JSON.parse(text);
          errMsg = errJson?.error?.message || errMsg;
        } catch { /* ignore */ }

        const error = new Error(errMsg);
        error.status = response.status;
        throw error;
      }

      return this.parseResponse(JSON.parse(text));
    },
  });
}

// ── Provider 6: Hugging Face ────────────────────────────────
const hfKeys = parseKeys(process.env.HUGGINGFACE_API_KEYS);
if (hfKeys.length > 0) {
  PROVIDERS.push({
    id: 'huggingface',
    name: 'Hugging Face',
    keys: hfKeys,
    baseUrl: 'https://api-inference.huggingface.co/models',
    models: [
      'meta-llama/Llama-3.2-11B-Vision-Instruct',
      'Qwen/Qwen2.5-72B-Instruct',
      'mistralai/Mistral-7B-Instruct-v0.3',
    ],
    supportsVision: true,
    currentKeyIndex: 0,

    getNextKey() {
      const key = this.keys[this.currentKeyIndex % this.keys.length];
      this.currentKeyIndex++;
      return key;
    },

    headers(apiKey) {
      return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      };
    },

    buildBody(messages, _model, opts = {}) {
      const cleanMessages = messages.map(m => {
        if (Array.isArray(m.content)) {
          return { ...m, content: m.content.filter(p => p.type === 'text').map(p => p.text).join('\n') };
        }
        return m;
      });

      return {
        inputs: cleanMessages.map(m => `${m.role}: ${m.content}`).join('\n\n'),
        parameters: {
          temperature: opts.temperature ?? TEMPERATURE,
          max_new_tokens: opts.max_tokens ?? MAX_TOKENS,
        },
      };
    },

    parseResponse(json) {
      const text = Array.isArray(json) ? json[0]?.generated_text || '' : json?.generated_text || '';
      return {
        content: text,
        usage: null,
      };
    },

    async call(messages, model, apiKey, opts) {
      const body = this.buildBody(messages, model, opts);
      const response = await fetch(`${this.baseUrl}/${model}`, {
        method: 'POST',
        headers: this.headers(apiKey),
        body: JSON.stringify(body),
      });

      const text = await response.text();

      if (!response.ok) {
        let errMsg = `Hugging Face API error: ${response.status}`;
        try {
          const errJson = JSON.parse(text);
          errMsg = errJson?.error || errJson?.message || errMsg;
        } catch { /* ignore */ }

        const error = new Error(errMsg);
        error.status = response.status;
        throw error;
      }

      return this.parseResponse(JSON.parse(text));
    },
  });
}

// ─── Deepgram (Speech-to-Text) ──────────────────────────────

export const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || '';
export const DEEPGRAM_BASE_URL = process.env.DEEPGRAM_BASE_URL || 'https://api.deepgram.com/v1';

export const DEEPGRAM_CONFIG = {
  language: process.env.DEEPGRAM_LANGUAGE || 'multi',
  model: process.env.DEEPGRAM_MODEL || 'nova-2',
  enableArabicDialects: process.env.DEEPGRAM_ENABLE_ARABIC_DIALECTS !== 'false',
  smartFormat: true,
  diarize: true,
};

// ─── General Config ─────────────────────────────────────────

export const CLIENT_URL = process.env.CLIENT_URL || `http://localhost:${process.env.PORT || 5000}`;
export const TEMPERATURE = clamp(process.env.TEMPERATURE, 0, 2, 0.8);
export const MAX_TOKENS = clamp(process.env.MAX_TOKENS, 1, 16000, 4096);

export const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT || '';

// ─── Startup Validation ─────────────────────────────────────

const totalKeys = PROVIDERS.reduce((sum, p) => sum + p.keys.length, 0);
const totalModels = PROVIDERS.reduce((sum, p) => sum + p.models.length, 0);

console.log('[Forked AI Engine] Initializing Multi-Provider AI Routing...');
if (PROVIDERS.length === 0) {
  console.warn('[Warning] No AI Providers configured in environment variables.');
} else {
  console.log(`[Providers] Loaded ${PROVIDERS.length} Provider(s) | ${totalKeys} API Key(s) | ${totalModels} Model(s)`);
  for (const p of PROVIDERS) {
    console.log(`  • ${p.name.padEnd(16)} : ${p.keys.length} Key(s), ${p.models.length} Model(s)`);
  }
}
console.log(`[Speech-to-Text] Deepgram: ${DEEPGRAM_API_KEY ? 'Configured' : 'Not configured'}\n`);

export default {
  PROVIDERS,
  DEEPGRAM_API_KEY,
  DEEPGRAM_BASE_URL,
  DEEPGRAM_CONFIG,
  CLIENT_URL,
  TEMPERATURE,
  MAX_TOKENS,
  SYSTEM_PROMPT,
};