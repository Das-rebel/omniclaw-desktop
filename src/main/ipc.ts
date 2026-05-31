import { ipcMain, app, shell } from 'electron';
import fs from 'fs';
import path from 'path';

// ──────────────────────────────────────────────
// Config — stored as JSON in userData
// ──────────────────────────────────────────────

const configPath = path.join(app.getPath('userData'), 'omniclaw-config.json');

function readConfig(): Record<string, unknown> {
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeConfig(config: Record<string, unknown>) {
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

ipcMain.handle('config:get', (_event, key?: string) => {
  const config = readConfig();
  if (key) return config[key] ?? null;
  return config;
});

ipcMain.handle('config:set', (_event, key: string, value: unknown) => {
  const config = readConfig();
  config[key] = value;
  writeConfig(config);
  return true;
});

ipcMain.handle('config:getAll', () => {
  return readConfig();
});

// ──────────────────────────────────────────────
// Providers — stored under config.providers
// ──────────────────────────────────────────────

ipcMain.handle('providers:getKeys', () => {
  const config = readConfig();
  return (config.providers as Record<string, string>) ?? {};
});

ipcMain.handle('providers:setKey', (_event, provider: string, key: string) => {
  const config = readConfig();
  if (!config.providers) config.providers = {};
  (config.providers as Record<string, string>)[provider] = key;
  writeConfig(config);
  return true;
});

ipcMain.handle('providers:removeKey', (_event, provider: string) => {
  const config = readConfig();
  if (config.providers && typeof config.providers === 'object') {
    delete (config.providers as Record<string, string>)[provider];
  }
  writeConfig(config);
  return true;
});

// ──────────────────────────────────────────────
// Conversations — stored as JSON files in userData/conversations/
// ──────────────────────────────────────────────

const conversationsDir = path.join(app.getPath('userData'), 'conversations');

function ensureConversationsDir() {
  if (!fs.existsSync(conversationsDir)) {
    fs.mkdirSync(conversationsDir, { recursive: true });
  }
}

ipcMain.handle('conversations:list', () => {
  ensureConversationsDir();
  try {
    const files = fs.readdirSync(conversationsDir).filter((f) => f.endsWith('.json'));
    const conversations = files.map((f) => {
      try {
        const raw = fs.readFileSync(path.join(conversationsDir, f), 'utf-8');
        const data = JSON.parse(raw);
        return {
          id: f.replace('.json', ''),
          title: data.title || 'Untitled',
          createdAt: data.createdAt || null,
          updatedAt: data.updatedAt || null,
        };
      } catch {
        return null;
      }
    }).filter(Boolean);
    return conversations;
  } catch {
    return [];
  }
});

ipcMain.handle('conversations:get', (_event, id: string) => {
  ensureConversationsDir();
  try {
    const filePath = path.join(conversationsDir, `${id}.json`);
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
});

ipcMain.handle('conversations:save', (_event, id: string, data: unknown) => {
  ensureConversationsDir();
  const filePath = path.join(conversationsDir, `${id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  return true;
});

ipcMain.handle('conversations:delete', (_event, id: string) => {
  ensureConversationsDir();
  const filePath = path.join(conversationsDir, `${id}.json`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  return true;
});

// ──────────────────────────────────────────────
// Shell / App utilities
// ──────────────────────────────────────────────

ipcMain.handle('shell:openPath', (_event, p: string) => {
  shell.openPath(p);
});

ipcMain.handle('app:getPath', (_event, name: string) => {
  return app.getPath(name as any);
});

ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

// ──────────────────────────────────────────────
// LLM Chat — calls provider APIs from the main process
// (API keys never reach the renderer)
// ──────────────────────────────────────────────

// ──────────────────────────────────────────────
// Notes & Collections Storage
// ──────────────────────────────────────────────

const DATA_DIR = path.join(app.getPath('userData'), 'omniclaw-data');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  // Subdirs
  for (const dir of ['collections', 'notes', 'bookmark-notes']) {
    const p = path.join(DATA_DIR, dir);
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  }
}

// Collections CRUD
ipcMain.handle('collections:list', () => {
  ensureDataDir();
  const dir = path.join(DATA_DIR, 'collections');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  return files.map(f => {
    try {
      return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
    } catch { return null; }
  }).filter(Boolean).sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0));
});

ipcMain.handle('collections:get', (_event, id: string) => {
  ensureDataDir();
  const fp = path.join(DATA_DIR, 'collections', `${id}.json`);
  if (!fs.existsSync(fp)) return null;
  return JSON.parse(fs.readFileSync(fp, 'utf-8'));
});

ipcMain.handle('collections:save', (_event, id: string, data: any) => {
  ensureDataDir();
  data.updatedAt = Date.now();
  fs.writeFileSync(path.join(DATA_DIR, 'collections', `${id}.json`), JSON.stringify(data, null, 2));
  return true;
});

ipcMain.handle('collections:delete', (_event, id: string) => {
  ensureDataDir();
  const fp = path.join(DATA_DIR, 'collections', `${id}.json`);
  if (fs.existsSync(fp)) fs.unlinkSync(fp);
  return true;
});

// Notes CRUD (standalone notes)
ipcMain.handle('notes:list', () => {
  ensureDataDir();
  const dir = path.join(DATA_DIR, 'notes');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  return files.map(f => {
    try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')); }
    catch { return null; }
  }).filter(Boolean).sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0));
});

ipcMain.handle('notes:save', (_event, id: string, data: any) => {
  ensureDataDir();
  data.updatedAt = Date.now();
  fs.writeFileSync(path.join(DATA_DIR, 'notes', `${id}.json`), JSON.stringify(data, null, 2));
  return true;
});

ipcMain.handle('notes:delete', (_event, id: string) => {
  ensureDataDir();
  const fp = path.join(DATA_DIR, 'notes', `${id}.json`);
  if (fs.existsSync(fp)) fs.unlinkSync(fp);
  return true;
});

// Bookmark Notes (notes attached to a vault bookmark URL or ID)
ipcMain.handle('bookmarkNotes:list', () => {
  ensureDataDir();
  const dir = path.join(DATA_DIR, 'bookmark-notes');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  return files.map(f => {
    try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')); }
    catch { return null; }
  }).filter(Boolean);
});

ipcMain.handle('bookmarkNotes:get', (_event, bookmarkId: string) => {
  ensureDataDir();
  const fp = path.join(DATA_DIR, 'bookmark-notes', `${bookmarkId}.json`);
  if (!fs.existsSync(fp)) return null;
  return JSON.parse(fs.readFileSync(fp, 'utf-8'));
});

ipcMain.handle('bookmarkNotes:save', (_event, bookmarkId: string, data: any) => {
  ensureDataDir();
  data.updatedAt = Date.now();
  fs.writeFileSync(path.join(DATA_DIR, 'bookmark-notes', `${bookmarkId}.json`), JSON.stringify(data, null, 2));
  return true;
});

ipcMain.handle('bookmarkNotes:delete', (_event, bookmarkId: string) => {
  ensureDataDir();
  const fp = path.join(DATA_DIR, 'bookmark-notes', `${bookmarkId}.json`);
  if (fs.existsSync(fp)) fs.unlinkSync(fp);
  return true;
});

// ──────────────────────────────────────────────
// LLM Chat
// ──────────────────────────────────────────────

const LLM_TIMEOUT_MS = 30_000; // 30s — some providers are slow

const OMNI_SYSTEM_PROMPT = `You are OmniClaw, a personal AI assistant and control center. 
You help the user manage their services and answer questions. 
Be helpful, concise, and self-aware. 
When asked who you are, identify as OmniClaw — never as your underlying model provider.

IMPORTANT ABOUT VAULT: You do NOT have direct vault access. If the user wants vault data 
(watch history, bookmarks, tweets, Instagram posts, preferences), tell them to type 
"@vault <query>" in the chat — the OmniClaw system will search their 17,641-item vault 
and show results. Never pretend you can search the vault yourself.`;

function prepSystemMsg(messages: { role: string; content: string }[]): { role: string; content: string }[] {
  // Prepend OmniClaw system prompt to every call
  return [{ role: 'system', content: OMNI_SYSTEM_PROMPT }, ...messages];
}

// ── Resilience layer ──

const TRANSIENT_STATUSES = new Set([408, 429, 500, 502, 503, 504, 529]);
const providerFailures = new Map<string, { count: number; lastFail: number }>();
const CIRCUIT_OPEN_DURATION_MS = 30_000;
const MAX_CONSECUTIVE_FAILURES = 3;

function isCircuitOpen(providerId: string): boolean {
  const f = providerFailures.get(providerId);
  if (!f) return false;
  if (f.count < MAX_CONSECUTIVE_FAILURES) return false;
  const elapsed = Date.now() - f.lastFail;
  if (elapsed > CIRCUIT_OPEN_DURATION_MS) {
    providerFailures.delete(providerId); // Reset
    return false;
  }
  return true;
}

function recordFailure(providerId: string) {
  const f = providerFailures.get(providerId) || { count: 0, lastFail: 0 };
  f.count += 1;
  f.lastFail = Date.now();
  providerFailures.set(providerId, f);
}

function recordSuccess(providerId: string) {
  providerFailures.delete(providerId);
}

async function withRetry<T>(
  providerId: string,
  fn: () => Promise<T>,
  maxRetries = 2
): Promise<T> {
  // Circuit breaker check
  if (isCircuitOpen(providerId)) {
    throw new Error(`${providerId}: circuit open — temporarily disabled`);
  }

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      recordSuccess(providerId);
      return result;
    } catch (err: any) {
      lastError = err;
      const statusCode = parseInt(err.message?.match(/\b(\d{3})\b/)?.[1] || '0');
      const isTransient = TRANSIENT_STATUSES.has(statusCode) ||
        err.message?.includes('overloaded') ||
        err.message?.includes('peak-hour') ||
        err.message?.includes('temporarily') ||
        err.name === 'TimeoutError' ||
        err.name === 'AbortError';

      if (isTransient && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 500; // 500ms, 1s, 2s
        console.log(`[OmniClaw] ${providerId} retry ${attempt + 1}/${maxRetries} in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      break;
    }
  }

  recordFailure(providerId);
  throw lastError;
}

async function callOpenAI(
  apiKey: string,
  messages: { role: string; content: string }[],
  model: string
): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: prepSystemMsg(messages).map((m) => ({ role: m.role, content: m.content })),
      max_tokens: 4096,
    }),
    signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`OpenAI ${res.status}: ${errBody}`);
  }
  const data = (await res.json()) as any;
  return data.choices?.[0]?.message?.content ?? '';
}

async function callAnthropic(
  apiKey: string,
  messages: { role: string; content: string }[],
  model: string
): Promise<string> {
  const systemMsg = messages.find((m) => m.role === 'system');
  const chatMsgs = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }));

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: systemMsg?.content ? OMNI_SYSTEM_PROMPT + '\n\n' + systemMsg.content : OMNI_SYSTEM_PROMPT,
      messages: chatMsgs,
    }),
    signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Anthropic ${res.status}: ${errBody}`);
  }
  const data = (await res.json()) as any;
  return data.content?.[0]?.text ?? '';
}

async function callGemini(
  apiKey: string,
  messages: { role: string; content: string }[],
  model: string
): Promise<string> {
  // Extract system message for Gemini's systemInstruction
  const sysMsg = messages.find((m) => m.role === 'system');
  const systemInstruction = sysMsg ? { parts: [{ text: sysMsg.content }] } : undefined;

  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const body: any = { contents };
  if (systemInstruction) body.systemInstruction = systemInstruction;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': apiKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    }
  );
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Gemini ${res.status}: ${errBody}`);
  }
  const data = (await res.json()) as any;
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

async function callGroq(
  apiKey: string,
  messages: { role: string; content: string }[],
  model: string
): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: prepSystemMsg(messages).map((m) => ({ role: m.role, content: m.content })),
      max_tokens: 4096,
    }),
    signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Groq ${res.status}: ${errBody}`);
  }
  const data = (await res.json()) as any;
  return data.choices?.[0]?.message?.content ?? '';
}

async function callCerebras(
  apiKey: string,
  messages: { role: string; content: string }[],
  model: string
): Promise<string> {
  const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: prepSystemMsg(messages).map((m) => ({ role: m.role, content: m.content })),
      max_tokens: 4096,
    }),
    signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Cerebras ${res.status}: ${errBody}`);
  }
  const data = (await res.json()) as any;
  return data.choices?.[0]?.message?.content ?? '';
}

async function callOllama(
  _apiKey: string,
  messages: { role: string; content: string }[],
  model: string
): Promise<string> {
  const prompt = messages.map((m) => `${m.role}: ${m.content}`).join('\n');
  const res = await fetch('http://127.0.0.1:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false }),
    signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Ollama ${res.status}: ${errBody}`);
  }
  const data = (await res.json()) as any;
  return data.response ?? '';
}

async function callMiniMax(
  apiKey: string,
  messages: { role: string; content: string }[],
  model: string
): Promise<string> {
  const res = await fetch('https://api.minimax.io/v1/text/chatcompletion_v2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: prepSystemMsg(messages).map((m) => ({ role: m.role, content: m.content })),
      max_tokens: 4096,
    }),
    signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`MiniMax ${res.status}: ${errBody}`);
  }
  const data = (await res.json()) as any;
  return data.choices?.[0]?.message?.content ?? '';
}

async function callGLM(
  apiKey: string,
  messages: { role: string; content: string }[],
  model: string
): Promise<string> {
  const res = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: prepSystemMsg(messages).map((m) => ({ role: m.role, content: m.content })),
      max_tokens: 4096,
    }),
    signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`GLM ${res.status}: ${errBody}`);
  }
  const data = (await res.json()) as any;
  return data.choices?.[0]?.message?.content ?? '';
}

async function callOpenRouter(
  apiKey: string,
  messages: { role: string; content: string }[],
  model: string
): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'http://localhost:1212',
      'X-Title': 'OmniClaw Desktop',
    },
    body: JSON.stringify({
      model,
      messages: prepSystemMsg(messages).map((m) => ({ role: m.role, content: m.content })),
      max_tokens: 4096,
    }),
    signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${errBody}`);
  }
  const data = (await res.json()) as any;
  return data.choices?.[0]?.message?.content ?? '';
}

// Wraps a caller with retry + circuit breaker
function resilientCaller(
  providerId: string,
  fn: (apiKey: string, messages: any[], model: string) => Promise<string>
) {
  return async (apiKey: string, messages: any[], model: string) => {
    return withRetry(providerId, () => fn(apiKey, messages, model));
  };
}

const llmCallers: Record<
  string,
  (
    apiKey: string,
    messages: { role: string; content: string }[],
    model: string
  ) => Promise<string>
> = {
  openai: resilientCaller('openai', callOpenAI),
  anthropic: resilientCaller('anthropic', callAnthropic),
  gemini: resilientCaller('gemini', callGemini),
  groq: resilientCaller('groq', callGroq),
  cerebras: resilientCaller('cerebras', callCerebras),
  ollama: callOllama, // local — no retry needed
  minimax: resilientCaller('minimax', callMiniMax),
  glm: resilientCaller('glm', callGLM),
  openrouter: resilientCaller('openrouter', callOpenRouter),
};

ipcMain.handle(
  'llm:chat',
  async (
    _event,
    {
      providerId,
      messages,
      model,
    }: { providerId: string; messages: { role: string; content: string }[]; model: string }
  ) => {
    // Look up API key from stored config (never from the renderer)
    const config = readConfig();
    const providers = (config.providers as Record<string, string>) ?? {};
    const apiKey = providers[providerId] ?? '';

    if (providerId !== 'ollama' && !apiKey) {
      throw new Error('No API key configured');
    }

    const caller = llmCallers[providerId];
    if (!caller) {
      throw new Error(`Unknown provider: ${providerId}`);
    }

    return caller(apiKey, messages, model);
  }
);

// Circuit breaker status for UI
ipcMain.handle('llm:circuit-status', () => {
  const status: Record<string, { open: boolean; failures: number }> = {};
  for (const [id, f] of providerFailures) {
    status[id] = { open: isCircuitOpen(id), failures: f.count };
  }
  return status;
});