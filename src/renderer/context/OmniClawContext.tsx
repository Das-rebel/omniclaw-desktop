import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface ProviderConfig {
  id: string;
  name: string;
  color: string;
  models: string[];
  defaultModel: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  provider?: string;
  model?: string;
  status: 'sending' | 'streaming' | 'done' | 'error';
  error?: string;
  timestamp: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

// ──────────────────────────────────────────────
// OmniClaw Endpoints
// ──────────────────────────────────────────────

export const OMNICLAW_ENDPOINTS = {
  vaultSearch: {
    url: 'https://serve-vault-search-338789220059.asia-south1.run.app',
    name: 'Vault Search',
    icon: '🔍',
  },
  twitterSync: {
    url: 'https://twitter-sync-338789220059.asia-south1.run.app',
    name: 'Twitter Sync',
    icon: '🐦',
  },
  instagram: {
    url: 'https://instagram-sync-338789220059.asia-south1.run.app',
    name: 'Instagram',
    icon: '📸',
  },
  bookmarks: {
    url: 'https://bookmark-processor-338789220059.asia-south1.run.app',
    name: 'Bookmarks',
    icon: '🔖',
  },
  omniclaw: {
    url: 'https://omniclaw-gcs-338789220059.asia-south1.run.app',
    name: 'OmniClaw GCS',
    icon: '☁️',
  },
  tts: {
    url: 'https://celebrity-tts-338789220059.asia-south1.run.app',
    name: 'TTS',
    icon: '🔊',
  },
  story: {
    url: 'https://story-narrator-338789220059.asia-south1.run.app',
    name: 'Story Narrator',
    icon: '📖',
  },
  alexa: {
    url: 'https://alexa-handler-338789220059.asia-south1.run.app',
    name: 'Alexa',
    icon: '🗣️',
  },
  fusionDashboard: {
    url: 'https://fusion-dashboard-338789220059.asia-south1.run.app',
    name: 'Fusion Dashboard',
    icon: '📊',
  },
  vaultPipeline: {
    url: 'https://vault-pipeline-338789220059.asia-south1.run.app',
    name: 'Vault Pipeline',
    icon: '🔧',
  },
  vaultControl: {
    url: 'https://omniclaw-vault-control-338789220059.asia-south1.run.app',
    name: 'Vault Control',
    icon: '🎛️',
  },
  instatter: {
    url: 'https://instatter-338789220059.asia-south1.run.app',
    name: 'Instatter',
    icon: '📱',
  },
  telegramBot: {
    url: 'https://dasomni-bot-338789220059.asia-south1.run.app',
    name: 'Telegram Bot',
    icon: '✈️',
  },
};

export interface EndpointStatus {
  name: string;
  url: string;
  icon: string;
  status: 'online' | 'offline' | 'checking' | 'unknown';
  latency?: number;
  statusCode?: number;
}

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

export const AVAILABLE_PROVIDERS: ProviderConfig[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    color: '#10a37f',
    models: ['gpt-4o', 'gpt-4o-mini'],
    defaultModel: 'gpt-4o',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    color: '#d4a574',
    models: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022'],
    defaultModel: 'claude-sonnet-4-20250514',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    color: '#4285f4',
    models: ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'],
    defaultModel: 'gemini-2.5-flash-lite',
  },
  {
    id: 'groq',
    name: 'Groq',
    color: '#f55036',
    models: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768'],
    defaultModel: 'llama-3.3-70b-versatile',
  },
  {
    id: 'cerebras',
    name: 'Cerebras',
    color: '#7c3aed',
    models: ['gpt-oss-120b', 'zai-glm-4.7'],
    defaultModel: 'gpt-oss-120b',
  },
  {
    id: 'ollama',
    name: 'Ollama',
    color: '#6366f1',
    models: ['qwen3:4b'],
    defaultModel: 'qwen3:4b',
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    color: '#f97316',
    models: ['MiniMax-M2.7', 'MiniMax-M2'],
    defaultModel: 'MiniMax-M2.7',
  },
  {
    id: 'glm',
    name: 'GLM (ZhipuAI)',
    color: '#2563eb',
    models: ['glm-4-plus', 'glm-4-flash'],
    defaultModel: 'glm-4-plus',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    color: '#a855f7',
    models: [
      'google/gemma-4-31b-it:free',
      'google/gemma-4-26b-a4b-it:free',
      'nvidia/nemotron-3-super-120b-a12b:free',
    ],
    defaultModel: 'google/gemma-4-31b-it:free',
  },
];

// ──────────────────────────────────────────────
// Service API Functions
// ──────────────────────────────────────────────

async function checkEndpointHealth(
  url: string
): Promise<{ online: boolean; latency: number; statusCode?: number }> {
  const start = Date.now();
  try {
    // GCP Cloud Run services are online if they respond AT ALL.
    // 404 means the service is running but has no root route — still ONLINE.
    // Only connection failures / timeouts / DNS errors mean OFFLINE.
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const latency = Date.now() - start;
    return { online: true, latency, statusCode: res.status };
  } catch {
    const latency = Date.now() - start;
    return { online: false, latency };
  }
}

async function searchVaultAPI(query: string): Promise<any[]> {
  try {
    // Vault uses GET /search?q=  (Flask route) — not POST /api/search
    const url = `https://serve-vault-search-338789220059.asia-south1.run.app/search?q=${encodeURIComponent(query)}&limit=50`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.results ?? data ?? [];
  } catch {
    return [];
  }
}

async function fetchBookmarksAPI(): Promise<any[]> {
  try {
    // The vault indexes all Twitter bookmarks as nodes.
    // Search for recent bookmarked content via common query terms.
    // Vault returns results sorted by relevance+recency.
    const terms = ['bookmark', 'twitter', 'AI', 'startup', 'code', 'research'];
    const allResults: any[] = [];
    const seen = new Set<string>();

    for (const term of terms) {
      if (allResults.length >= 20) break;
      const url = `https://serve-vault-search-338789220059.asia-south1.run.app/search?q=${encodeURIComponent(term)}&limit=30`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) continue;
      const data = await res.json();
      const results = data.results ?? [];
      for (const r of results) {
        if (r.url && !seen.has(r.url)) {
          seen.add(r.url);
          allResults.push(r);
        }
      }
    }

    return allResults.slice(0, 20);
  } catch {
    return [];
  }
}

// ──────────────────────────────────────────────
// Context
// ──────────────────────────────────────────────

interface OmniClawContextValue {
  apiKeys: Record<string, string>;
  setApiKey: (provider: string, key: string) => Promise<void>;
  removeApiKey: (provider: string) => Promise<void>;
  selectedProviders: string[];
  toggleProvider: (id: string) => void;
  conversations: Conversation[];
  currentConversation: Conversation | null;
  createConversation: () => Conversation;
  loadConversation: (id: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  sendMessage: (content: string) => void;
  isLoading: boolean;
  // Service endpoints
  endpointStatuses: Record<string, EndpointStatus>;
  checkEndpointStatus: (endpointId: string) => Promise<void>;
  checkAllEndpoints: () => Promise<void>;
  lastChecked: number | null;
  // Vault search
  vaultSearchResults: any[];
  vaultSearchLoading: boolean;
  searchVault: (query: string) => Promise<any[]>;
  // Bookmarks
  bookmarks: any[];
  bookmarksLoading: boolean;
  fetchBookmarks: () => Promise<void>;
  // Service logs
  serviceLogs: Record<string, string[]>;
  addServiceLog: (serviceId: string, message: string) => void;
  // Provider health (actual reachability, not just key presence)
  providerHealth: Record<string, 'online' | 'offline' | 'unknown'>;
  checkProviderHealth: () => Promise<void>;
}

const OmniClawContext = createContext<OmniClawContextValue | null>(null);

// Initialize endpoint statuses
function getInitialEndpointStatuses(): Record<string, EndpointStatus> {
  const statuses: Record<string, EndpointStatus> = {};
  for (const [id, ep] of Object.entries(OMNICLAW_ENDPOINTS)) {
    statuses[id] = {
      name: ep.name,
      url: ep.url,
      icon: ep.icon,
      status: 'unknown',
    };
  }
  return statuses;
}

export function OmniClawProvider({ children }: { children: ReactNode }) {
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [selectedProviders, setSelectedProviders] = useState<string[]>([
    'openai',
  ]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] =
    useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Service endpoint state
  const [endpointStatuses, setEndpointStatuses] = useState<
    Record<string, EndpointStatus>
  >(getInitialEndpointStatuses);
  const [lastChecked, setLastChecked] = useState<number | null>(null);

  // Vault search state
  const [vaultSearchResults, setVaultSearchResults] = useState<any[]>([]);
  const [vaultSearchLoading, setVaultSearchLoading] = useState(false);

  // Bookmarks state
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [bookmarksLoading, setBookmarksLoading] = useState(false);

  // Service logs
  const [serviceLogs, setServiceLogs] = useState<Record<string, string[]>>(
    {}
  );

  // Provider health (actual API reachability)
  const [providerHealth, setProviderHealth] = useState<
    Record<string, 'online' | 'offline' | 'unknown'>
  >(() => {
    const init: Record<string, 'online' | 'offline' | 'unknown'> = {};
    for (const p of AVAILABLE_PROVIDERS) init[p.id] = 'unknown';
    return init;
  });

  const checkProviderHealth = useCallback(async () => {
    const providerEndpoints: Record<string, string> = {
      openai: 'https://api.openai.com/v1/models',
      anthropic: 'https://api.anthropic.com/v1/models',
      gemini: 'https://generativelanguage.googleapis.com/v1beta/models',
      groq: 'https://api.groq.com/openai/v1/models',
      cerebras: 'https://api.cerebras.ai/v1/models',
      ollama: 'http://127.0.0.1:11434/api/tags',
      minimax: 'https://api.minimax.io/v1/models',
      glm: 'https://open.bigmodel.cn/api/paas/v4/models',
      openrouter: 'https://openrouter.ai/api/v1/models',
    };

    const results: Record<string, 'online' | 'offline' | 'unknown'> = {};
    for (const [id, url] of Object.entries(providerEndpoints)) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        // Any response (401, 403, 200) means the API is reachable
        results[id] = 'online';
      } catch {
        results[id] = 'offline';
      }
    }
    setProviderHealth(results);
  }, []);

  const addServiceLog = useCallback(
    (serviceId: string, message: string) => {
      setServiceLogs((prev) => {
        const logs = prev[serviceId] ?? [];
        const timestamp = new Date().toLocaleTimeString();
        return {
          ...prev,
          [serviceId]: [
            ...logs.slice(-49),
            `[${timestamp}] ${message}`,
          ],
        };
      });
    },
    []
  );

  // Load API keys and conversations on mount
  useEffect(() => {
    const init = async () => {
      try {
        const keys = (await window.electron.providers.getKeys()) as Record<
          string,
          string
        >;
        setApiKeys(keys || {});
      } catch (e) {
        console.error('Failed to load provider keys:', e);
      }
      try {
        const list = (await window.electron.conversations.list()) as Conversation[];
        setConversations(list || []);
      } catch (e) {
        console.error('Failed to load conversations:', e);
      }
    };
    init();
  }, []);

  // Auto-save conversation with debounce
  const saveConversation = useCallback((conv: Conversation) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      window.electron.conversations.save(conv.id, conv).catch(console.error);
    }, 500);
  }, []);

  // Save whenever currentConversation changes
  useEffect(() => {
    if (currentConversation && currentConversation.messages.length > 0) {
      saveConversation(currentConversation);
    }
  }, [currentConversation, saveConversation]);

  const setApiKey = useCallback(async (provider: string, key: string) => {
    await window.electron.providers.setKey(provider, key);
    setApiKeys((prev) => ({ ...prev, [provider]: key }));
  }, []);

  const removeApiKey = useCallback(async (provider: string) => {
    await window.electron.providers.removeKey(provider);
    setApiKeys((prev) => {
      const next = { ...prev };
      delete next[provider];
      return next;
    });
  }, []);

  const toggleProvider = useCallback((id: string) => {
    setSelectedProviders((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }, []);

  const createConversation = useCallback(() => {
    const id = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const conv: Conversation = {
      id,
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setCurrentConversation(conv);
    setConversations((prev) => [conv, ...prev]);
    return conv;
  }, []);

  const loadConversation = useCallback(async (id: string) => {
    const data = (await window.electron.conversations.get(
      id
    )) as Conversation | null;
    if (data) {
      setCurrentConversation(data);
    }
  }, []);

  const deleteConversation = useCallback(
    async (id: string) => {
      await window.electron.conversations.delete(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (currentConversation?.id === id) {
        setCurrentConversation(null);
      }
    },
    [currentConversation]
  );

  // ── sendMessage (FIX 2: stable IDs, FIX 3: completion tracking) ──

  const sendMessage = useCallback(
    async (content: string, forceConv?: Conversation) => {
      const conv = forceConv || currentConversation;
      if (!conv) return;
      if (selectedProviders.length === 0) {
        addServiceLog('chat', 'No providers selected — cannot send');
        return;
      }

      // FIX 2: Generate all message IDs upfront before async callbacks
      const now = Date.now();
      const userMsgId = `msg_user_${now}`;

      const providerMsgIds: Record<string, string> = {};
      selectedProviders.forEach((providerId, i) => {
        providerMsgIds[providerId] = `msg_${providerId}_${now}_${i}`;
      });

      const userMsg: Message = {
        id: userMsgId,
        role: 'user',
        content,
        status: 'done',
        timestamp: now,
      };

      // Build the conversation history for API calls
      const history = conv.messages
        .filter((m) => m.status === 'done')
        .map((m) => ({ role: m.role, content: m.content }));
      history.push({ role: 'user', content });

      // Build provider messages: single = named provider, multi = "OmniClaw Council"
      const isCouncil = selectedProviders.length > 1;
      const providerMessages: Message[] = isCouncil
        ? [
            {
              id: `msg_council_${now}`,
              role: 'assistant' as const,
              content: '',
              provider: 'council',
              model: `${selectedProviders.length} models`,
              status: 'sending' as const,
              timestamp: now,
            },
          ]
        : selectedProviders.map((providerId) => {
            const provider = AVAILABLE_PROVIDERS.find((p) => p.id === providerId);
            return {
              id: providerMsgIds[providerId],
              role: 'assistant' as const,
              content: '',
              provider: providerId,
              model: provider?.defaultModel ?? providerId,
              status: 'sending' as const,
              timestamp: now,
            };
          });

      const updatedTitle =
        conv.messages.length === 0
          ? content.slice(0, 50) + (content.length > 50 ? '...' : '')
          : conv.title;

      const updatedConv: Conversation = {
        ...conv,
        title: updatedTitle,
        messages: [
          ...conv.messages,
          userMsg,
          ...providerMessages,
        ],
        updatedAt: now,
      };
      setCurrentConversation(updatedConv);
      setIsLoading(true);

      // ── Council mode: race all providers, use first success ──
      const councilMsgId = `msg_council_${now}`;

      if (isCouncil) {
        // Race all providers — first success wins, show who responded
        const raceResult = await Promise.any(
          selectedProviders.map(async (providerId) => {
            if (providerId !== 'ollama' && !apiKeys[providerId]) {
              throw new Error('No API key configured');
            }
            const model =
              AVAILABLE_PROVIDERS.find((p) => p.id === providerId)
                ?.defaultModel ?? providerId;
            const result = await window.electron.llm.chat(providerId, history, model);
            return { providerId, content: result };
          })
        ).catch(() => null);

        setCurrentConversation((prev) => {
          if (!prev) return prev;
          const providerName = raceResult
            ? AVAILABLE_PROVIDERS.find((p) => p.id === raceResult.providerId)?.name || raceResult.providerId
            : '';
          return {
            ...prev,
            messages: prev.messages.map((m) =>
              m.id === councilMsgId
                ? raceResult
                  ? {
                      ...m,
                      content: raceResult.content,
                      status: 'done' as const,
                      model: `via ${providerName}`,
                    }
                  : { ...m, status: 'error' as const, error: `All ${selectedProviders.length} providers failed — retry or check keys` }
                : m
            ),
          };
        });
        setIsLoading(false);
      } else {
        // ── Single provider mode (existing behavior) ──
        const totalProviders = selectedProviders.length;
        let completedProviders = 0;

        const handleProviderComplete = () => {
          completedProviders += 1;
          if (completedProviders >= totalProviders) {
            setIsLoading(false);
          }
        };

        selectedProviders.forEach(async (providerId) => {
          const msgId = providerMsgIds[providerId];

          if (providerId !== 'ollama' && !apiKeys[providerId]) {
            setCurrentConversation((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                messages: prev.messages.map((m) =>
                  m.id === msgId
                    ? { ...m, status: 'error' as const, error: 'No API key configured' }
                    : m
                ),
              };
            });
            handleProviderComplete();
            return;
          }

          const model =
            AVAILABLE_PROVIDERS.find((p) => p.id === providerId)
              ?.defaultModel ?? providerId;

          try {
            setCurrentConversation((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                messages: prev.messages.map((m) =>
                  m.id === msgId && m.status === 'sending'
                    ? { ...m, status: 'streaming' as const }
                    : m
                ),
              };
            });

            const result = await window.electron.llm.chat(providerId, history, model);

            setCurrentConversation((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                messages: prev.messages.map((m) =>
                  m.id === msgId &&
                  (m.status === 'streaming' || m.status === 'sending')
                    ? { ...m, content: result, status: 'done' as const }
                    : m
                ),
              };
            });
          } catch (err: any) {
            setCurrentConversation((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                messages: prev.messages.map((m) =>
                  m.id === msgId &&
                  (m.status === 'streaming' || m.status === 'sending')
                    ? {
                        ...m,
                        status: 'error' as const,
                        error: err.message || 'Unknown error',
                      }
                    : m
                ),
              };
            });
          } finally {
            handleProviderComplete();
          }
        });
      }
    },
    [currentConversation, selectedProviders, apiKeys]
  );

  // ── Endpoint health checks ──

  const checkEndpointStatus = useCallback(
    async (endpointId: string) => {
      const ep = OMNICLAW_ENDPOINTS[endpointId as keyof typeof OMNICLAW_ENDPOINTS];
      if (!ep) return;

      setEndpointStatuses((prev) => ({
        ...prev,
        [endpointId]: { ...prev[endpointId], status: 'checking' },
      }));
      addServiceLog(endpointId, 'Health check started…');

      const { online, latency, statusCode } = await checkEndpointHealth(ep.url);
      setEndpointStatuses((prev) => ({
        ...prev,
        [endpointId]: {
          ...prev[endpointId],
          status: online ? 'online' : 'offline',
          latency,
          statusCode,
        },
      }));
      addServiceLog(
        endpointId,
        online
          ? `Online (${latency}ms, HTTP ${statusCode})`
          : `Offline (took ${latency}ms)`
      );
    },
    [addServiceLog]
  );

  const checkAllEndpoints = useCallback(async () => {
    const entries = Object.keys(OMNICLAW_ENDPOINTS);
    await Promise.all(entries.map((id) => checkEndpointStatus(id)));
    setLastChecked(Date.now());
  }, [checkEndpointStatus]);

  // ── Vault search ──

  const searchVault = useCallback(
    async (query: string): Promise<any[]> => {
      setVaultSearchLoading(true);
      addServiceLog('vaultSearch', `Searching: "${query}"`);
      try {
        const results = await searchVaultAPI(query);
        // Deduplicate by URL + content hash, keeping the first occurrence
        const seen = new Set<string>();
        const deduped = results.filter((r: any) => {
          const key = r.url || r.link || r.name;
          // Fallback: use first 60 chars of content to catch Instagram dupes
          const contentKey = (r.content || '').slice(0, 60);
          const dedupeKey = `${key}::${contentKey}`;
          if (!key || seen.has(dedupeKey)) return false;
          seen.add(dedupeKey);
          return true;
        });
        setVaultSearchResults(deduped);
        addServiceLog(
          'vaultSearch',
          `Found ${deduped.length} results (${results.length - deduped.length} duplicates removed)`
        );
        return deduped;
      } catch {
        addServiceLog('vaultSearch', 'Search failed');
        return [];
      } finally {
        setVaultSearchLoading(false);
      }
    },
    [addServiceLog]
  );

  // ── Bookmarks ──

  const fetchBookmarks = useCallback(async () => {
    setBookmarksLoading(true);
    addServiceLog('bookmarks', 'Fetching bookmarks…');
    try {
      const items = await fetchBookmarksAPI();
      setBookmarks(items);
      addServiceLog('bookmarks', `Fetched ${items.length} bookmarks`);
    } catch {
      addServiceLog('bookmarks', 'Failed to fetch bookmarks');
    } finally {
      setBookmarksLoading(false);
    }
  }, [addServiceLog]);

  const value: OmniClawContextValue = {
    apiKeys,
    setApiKey,
    removeApiKey,
    selectedProviders,
    toggleProvider,
    conversations,
    currentConversation,
    createConversation,
    loadConversation,
    deleteConversation,
    sendMessage,
    isLoading,
    // Endpoints
    endpointStatuses,
    checkEndpointStatus,
    checkAllEndpoints,
    lastChecked,
    // Vault
    vaultSearchResults,
    vaultSearchLoading,
    searchVault,
    // Bookmarks
    bookmarks,
    bookmarksLoading,
    fetchBookmarks,
    // Logs
    serviceLogs,
    addServiceLog,
    // Provider health
    providerHealth,
    checkProviderHealth,
  };

  return (
    <OmniClawContext.Provider value={value}>
      {children}
    </OmniClawContext.Provider>
  );
}

export function useOmniClaw() {
  const ctx = useContext(OmniClawContext);
  if (!ctx) throw new Error('useOmniClaw must be used within OmniClawProvider');
  return ctx;
}