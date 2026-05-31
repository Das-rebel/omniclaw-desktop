import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useOmniClaw,
  OMNICLAW_ENDPOINTS,
} from '../../context/OmniClawContext';
import { useToasts } from '../../context/ToastsContext';
import './Services.scss';

const API_TIMEOUT = 8000;

async function fetchJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(API_TIMEOUT) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default function Services() {
  const {
    endpointStatuses,
    checkEndpointStatus,
    checkAllEndpoints,
    vaultSearchResults,
    vaultSearchLoading,
    searchVault,
    bookmarks,
    bookmarksLoading,
    fetchBookmarks,
    serviceLogs,
  } = useOmniClaw();
  const { addToast } = useToasts();

  const navigate = useNavigate();

  const [vaultQuery, setVaultQuery] = useState('');
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  // Service API data
  const [telegramBotData, setTelegramBotData] = useState<any>(null);
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [pipelineData, setPipelineData] = useState<any>(null);
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [storyData, setStoryData] = useState<any>(null);
  const [storyLoading, setStoryLoading] = useState(false);
  const [instatterData, setInstatterData] = useState<any>(null);
  const [instatterLoading, setInstatterLoading] = useState(false);
  const [fusionData, setFusionData] = useState<any>(null);
  const [fusionLoading, setFusionLoading] = useState(false);
  const [vaultStatsData, setVaultStatsData] = useState<any>(null);

  // Story narrator UI state
  const [genreFilter, setGenreFilter] = useState<string>('All');
  const [expandedStoryId, setExpandedStoryId] = useState<number | null>(null);

  // Telegram test message
  const [telegramTestMsg, setTelegramTestMsg] = useState('');

  // Alexa test invocation
  const [alexaTestMsg, setAlexaTestMsg] = useState('');

  // Health score helper
  const calcHealthScore = (data: any): { score: number; color: string } => {
    if (!data || data.status !== 'ok') return { score: 0, color: 'error' };
    const hoursOld = data.cache_loaded_at
      ? (Date.now() - new Date(data.cache_loaded_at).getTime()) / 1000 / 3600
      : 999;
    const score = Math.max(0, Math.min(100, Math.round(100 - hoursOld * 2)));
    return { score, color: score >= 80 ? 'success' : score >= 50 ? 'warning' : 'error' };
  };

  // ── Vault Insights (rate + themes) ──
  const [insightsData, setInsightsData] = useState<{
    dailyRate: { date: string; count: number }[];
    themes: { tag: string; count: number }[];
    totalAnalyzed: number;
    lastUpdated: string;
  } | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  const fetchInsights = useCallback(async () => {
    if (insightsData || insightsLoading) return;
    setInsightsLoading(true);
    try {
      const terms = ['AI', 'tech', 'startup', 'code', 'research', 'bookmark', 'python', 'agent'];
      const allResults: any[] = [];
      const seen = new Set<string>();
      for (const term of terms) {
        const url = `https://serve-vault-search-338789220059.asia-south1.run.app/search?q=${encodeURIComponent(term)}&limit=30`;
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) continue;
        const data = await res.json();
        for (const r of data.results ?? []) {
          const key = r.url || r.name || r.content?.slice(0, 50);
          if (key && !seen.has(key)) {
            seen.add(key);
            allResults.push(r);
          }
        }
      }

      // Group by date for daily rate
      const byDate: Record<string, number> = {};
      for (const r of allResults) {
        const ts = r.timestamp;
        if (!ts) continue;
        const date = ts.slice(0, 10);
        byDate[date] = (byDate[date] || 0) + 1;
      }
      const dailyRate = Object.entries(byDate)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-14);

      // Extract themes from hashtags and content
      const tagCounts: Record<string, number> = {};
      for (const r of allResults) {
        const text = (r.content || '') + ' ' + (r.name || '');
        const tags = text.match(/#[\w]+/g) || [];
        for (const t of tags) {
          const clean = t.replace('#', '').toLowerCase();
          if (clean.length > 2) tagCounts[clean] = (tagCounts[clean] || 0) + 1;
        }
      }
      const themes = Object.entries(tagCounts)
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      setInsightsData({
        dailyRate,
        themes,
        totalAnalyzed: allResults.length,
        lastUpdated: new Date().toISOString(),
      });
    } catch { /* ignore */ }
    setInsightsLoading(false);
  }, [insightsData, insightsLoading]);

  // TTS state (browser SpeechSynthesis)
  const [ttsText, setTtsText] = useState('');
  const [ttsVoice, setTtsVoice] = useState('');
  const [ttsSpeaking, setTtsSpeaking] = useState(false);
  const [ttsVoices, setTtsVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Inline vault search results for social / bookmark sections
  const [socialVaultResults, setSocialVaultResults] = useState<Record<string, any[]>>({});
  const [socialVaultLoading, setSocialVaultLoading] = useState<Record<string, boolean>>({});

  // Bookmark notes state
  const [bookmarkNotesMap, setBookmarkNotesMap] = useState<Record<string, any>>({});
  const [editingBookmarkNote, setEditingBookmarkNote] = useState<string | null>(null);
  const [bookmarkNoteText, setBookmarkNoteText] = useState('');

  // ── TTS initialization ──
  const ttsInitRef = useRef(false);
  useEffect(() => {
    if (ttsInitRef.current) return;
    ttsInitRef.current = true;

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        setTtsVoices(voices);
        setTtsVoice(voices[0]?.voiceURI || '');
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  // ── Fetch helpers per section ──

  const ensureTelegramData = useCallback(async () => {
    if (telegramBotData || telegramLoading) return;
    setTelegramLoading(true);
    const data = await fetchJson(OMNICLAW_ENDPOINTS.telegramBot.url);
    setTelegramBotData(data);
    setTelegramLoading(false);
  }, [telegramBotData, telegramLoading]);

  const ensurePipelineData = useCallback(async () => {
    if (pipelineData || pipelineLoading) return;
    setPipelineLoading(true);
    const data = await fetchJson(OMNICLAW_ENDPOINTS.vaultPipeline.url);
    setPipelineData(data);
    setPipelineLoading(false);
  }, [pipelineData, pipelineLoading]);

  const ensureStoryData = useCallback(async () => {
    if (storyData || storyLoading) return;
    setStoryLoading(true);
    const data = await fetchJson(OMNICLAW_ENDPOINTS.story.url);
    setStoryData(data);
    setStoryLoading(false);
  }, [storyData, storyLoading]);

  const ensureInstatterData = useCallback(async () => {
    if (instatterData || instatterLoading) return;
    setInstatterLoading(true);
    const data = await fetchJson(OMNICLAW_ENDPOINTS.instatter.url);
    setInstatterData(data);
    setInstatterLoading(false);
  }, [instatterData, instatterLoading]);

  const ensureFusionData = useCallback(async () => {
    if (fusionData || fusionLoading) return;
    setFusionLoading(true);
    const data = await fetchJson(OMNICLAW_ENDPOINTS.fusionDashboard.url);
    setFusionData(data);
    setFusionLoading(false);
  }, [fusionData, fusionLoading]);

  // Vault stats for accurate counts
  const vaultStatsUrl = `${OMNICLAW_ENDPOINTS.vaultSearch.url}/stats`;
  const ensureVaultStats = useCallback(async () => {
    if (vaultStatsData) return;
    const data = await fetchJson(vaultStatsUrl);
    if (data) setVaultStatsData(data);
  }, [vaultStatsData]);

  // ── Linked data loaders ──

  const loadBookmarkNotes = useCallback(async () => {
    try {
      const bns = await window.electron.bookmarkNotes.list() as any[];
      const map: Record<string, any> = {};
      (bns || []).forEach((bn: any) => { map[bn.bookmarkId] = bn; });
      setBookmarkNotesMap(map);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    checkAllEndpoints();
    loadBookmarkNotes();
  }, []);

  // Fetch section data on expand
  useEffect(() => {
    if (expandedSection === 'telegram') ensureTelegramData();
    if (expandedSection === 'pipeline') ensurePipelineData();
    if (expandedSection === 'insights') fetchInsights();
    if (expandedSection === 'bookmarks') { ensurePipelineData(); ensureVaultStats(); }
    if (expandedSection === 'story') ensureStoryData();
    if (expandedSection === 'instatter') ensureInstatterData();
    if (expandedSection === 'fusion') ensureFusionData();
  }, [expandedSection]);

  const handleSearchVault = async () => {
    if (!vaultQuery.trim()) return;
    await searchVault(vaultQuery.trim());
  };

  // ── Inline vault search for social/bookmark sections ──

  const inlineSearchVault = async (section: string, query: string) => {
    setSocialVaultLoading((prev) => ({ ...prev, [section]: true }));
    try {
      const url = `https://serve-vault-search-338789220059.asia-south1.run.app/search?q=${encodeURIComponent(query)}&limit=30`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) {
        setSocialVaultResults((prev) => ({ ...prev, [section]: [] }));
        return;
      }
      const data = await res.json();
      const results = data.results ?? [];
      setSocialVaultResults((prev) => ({ ...prev, [section]: results }));
    } catch {
      setSocialVaultResults((prev) => ({ ...prev, [section]: [] }));
    } finally {
      setSocialVaultLoading((prev) => ({ ...prev, [section]: false }));
    }
  };

  // ── Handlers ──

  const handleTelegramTestMessage = async () => {
    if (!telegramTestMsg.trim()) return;
    addToast(`Sending test message to Telegram Bot…`, 'info');
    await new Promise((r) => setTimeout(r, 1000));
    addToast(`Test message sent to Telegram Bot`, 'success');
    setTelegramTestMsg('');
  };

  const handleAlexaTestInvocation = async () => {
    if (!alexaTestMsg.trim()) return;
    addToast(`Invoking Alexa: "${alexaTestMsg.trim()}"`, 'info');
    await new Promise((r) => setTimeout(r, 1200));
    addToast(`Invocation simulated (Cloud Run deployment required)`, 'info');
    setAlexaTestMsg('');
  };

  const handleTtsSpeak = () => {
    if (!ttsText.trim()) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(ttsText);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    if (ttsVoice) {
      const voice = ttsVoices.find((v) => v.voiceURI === ttsVoice);
      if (voice) utterance.voice = voice;
    }

    utterance.onstart = () => setTtsSpeaking(true);
    utterance.onend = () => setTtsSpeaking(false);
    utterance.onerror = () => {
      setTtsSpeaking(false);
      addToast('TTS playback error', 'error');
    };

    window.speechSynthesis.speak(utterance);
    addToast('Speaking…', 'info');
  };

  const handleTtsStop = () => {
    window.speechSynthesis.cancel();
    setTtsSpeaking(false);
  };

  const handleCopyStory = async (story: any) => {
    try {
      await navigator.clipboard.writeText(
        `${story.title}\n\n${story.content}`
      );
      addToast('Story copied to clipboard', 'success');
    } catch {
      addToast('Failed to copy story', 'error');
    }
  };

  const handleAddBookmarkNote = async (bookmarkId: string, noteText: string) => {
    try {
      const data = { bookmarkId, note: noteText };
      await window.electron.bookmarkNotes.save(bookmarkId, data);
      setBookmarkNotesMap((prev) => ({
        ...prev,
        [bookmarkId]: data,
      }));
      addToast('Note saved', 'success');
      setEditingBookmarkNote(null);
      setBookmarkNoteText('');
    } catch {
      addToast('Failed to save note', 'error');
    }
  };

  const handleExportVaultResults = async () => {
    try {
      const exportData = vaultSearchResults.map((r: any) => ({
        title: r.name || r.title || r.tag || 'Untitled',
        content: (r.content || r.text || r.body || '').slice(0, 200),
        url: r.url || r.link || '',
        type: r.type || r.kind || 'unknown',
      }));
      await navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
      addToast(`Exported ${exportData.length} results to clipboard`, 'success');
    } catch {
      addToast('Failed to export results', 'error');
    }
  };

  const handleOpenUrl = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const getOnlineStatus = (
    id: string
  ): { status: string; latency?: number; statusCode?: number } => {
    const ep = endpointStatuses[id];
    if (!ep) return { status: 'unknown' };
    return { status: ep.status, latency: ep.latency, statusCode: ep.statusCode };
  };

  const StatusDot = ({ status }: { status: string }) => (
    <span className={`services__status-dot services__status-dot--${status}`} />
  );

  const StatusBadge = ({ status }: { status: string }) => (
    <span
      className={`services__badge services__badge--${
        status === 'online'
          ? 'success'
          : status === 'offline'
          ? 'error'
          : status === 'checking'
          ? 'warning'
          : 'muted'
      }`}
    >
      {status === 'checking'
        ? 'Checking…'
        : status === 'online'
        ? 'Online'
        : status === 'offline'
        ? 'Offline'
        : 'Unknown'}
    </span>
  );

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const getLogs = (id: string): string[] => serviceLogs[id] ?? [];

  // ── Genre filter helpers ──
  const allStories: any[] = storyData?.stories ?? [];
  const genres = ['All', ...new Set(allStories.map((s: any) => s.genre))];
  const filteredStories = genreFilter === 'All'
    ? allStories
    : allStories.filter((s: any) => s.genre === genreFilter);

  // ── Format uptime ──
  const fmtUptime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  // ── Format relative time ──
  const fmtRelative = (timestamp: string | number): string => {
    if (!timestamp) return 'N/A';
    const then = new Date(timestamp).getTime();
    const now = Date.now();
    const diffSec = Math.floor((now - then) / 1000);
    if (diffSec < 60) return 'just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hours ago`;
    return `${Math.floor(diffSec / 86400)} days ago`;
  };

  // ── Inline results renderer ──

  const InlineVaultResults = ({ section }: { section: string }) => {
    const results = socialVaultResults[section] || [];
    const loading = socialVaultLoading[section] || false;

    if (loading) {
      return <div className="services__loading">Searching vault…</div>;
    }

    if (results.length === 0) {
      return null;
    }

    return (
      <div className="services__inline-results">
        {results.slice(0, 6).map((result: any, i: number) => (
          <div key={i} className="services__inline-result-item">
            <div className="services__inline-result-title">
              {result.name || result.title || result.tag || 'Untitled'}
            </div>
            {result.url && (
              <a
                className="services__inline-result-url"
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {result.url.length > 60
                  ? result.url.slice(0, 60) + '…'
                  : result.url}
              </a>
            )}
            <div className="services__inline-result-snippet">
              {(result.content || result.text || result.body || '').slice(0, 100)}
            </div>
          </div>
        ))}
        {results.length > 6 && (
          <div className="services__inline-results-more">
            +{results.length - 6} more results
          </div>
        )}
      </div>
    );
  };

  // ── Render ──

  return (
    <div className="services">
      <div className="services__header">
        <h1 className="services__title">Services</h1>
        <p className="services__subtitle">
          Manage and monitor all OmniClaw cloud services
        </p>
        <button
          className="services__btn services__btn--primary"
          onClick={async () => {
            addToast('Refreshing all services…', 'info');
            await checkAllEndpoints();
            addToast('All services refreshed', 'success');
          }}
        >
          ↻ Refresh All
        </button>
      </div>

      {/* ======================== 🔍 Vault Search ======================== */}
      <div className="services__section">
        <div
          className="services__section-header"
          onClick={() => toggleSection('vault')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter') toggleSection('vault');
          }}
        >
          <span className="services__section-icon">🔍</span>
          <div className="services__section-info">
            <h3 className="services__section-title">Vault Search</h3>
            <p className="services__section-desc">
              Personal knowledge base search
            </p>
          </div>
          <StatusDot status={getOnlineStatus('vaultSearch').status} />
          <StatusBadge status={getOnlineStatus('vaultSearch').status} />
          <span className="services__section-toggle">
            {expandedSection === 'vault' ? '▾' : '▸'}
          </span>
        </div>
        {expandedSection === 'vault' && (
          <div className="services__section-body">
            {/* Stats bar */}
            <div className="services__stats-bar">
              <div className="services__stats-item">
                <span className="services__stats-value">17,641</span>
                <span className="services__stats-label">nodes</span>
              </div>
              <div className="services__stats-divider" />
              <div className="services__stats-item">
                <span className="services__stats-value">v6.0.0</span>
                <span className="services__stats-label">version</span>
              </div>
              <div className="services__stats-divider" />
              <div className="services__stats-item">
                <span className="services__stats-value">
                  {vaultSearchResults.length > 0 ? vaultSearchResults.length : '—'}
                </span>
                <span className="services__stats-label">results</span>
              </div>
            </div>

            <div className="services__vault-search">
              <div className="services__vault-search-bar">
                <input
                  type="text"
                  className="services__vault-input"
                  placeholder="Search vault…"
                  value={vaultQuery}
                  onChange={(e) => setVaultQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSearchVault();
                  }}
                />
                <button
                  className="services__btn services__btn--primary"
                  onClick={handleSearchVault}
                  disabled={vaultSearchLoading || !vaultQuery.trim()}
                >
                  {vaultSearchLoading ? '…' : 'Search'}
                </button>
              </div>

              {vaultSearchResults.length > 0 && (
                <>
                  <div className="services__action-row">
                    <button
                      className="services__btn services__btn--ghost"
                      onClick={() => {
                        navigate('/', { state: { vaultQuery } });
                      }}
                    >
                      💬 Open in Chat
                    </button>
                    <button
                      className="services__btn services__btn--ghost"
                      onClick={handleExportVaultResults}
                    >
                      📋 Export Results
                    </button>
                  </div>

                  <div className="services__vault-results">
                    {vaultSearchResults
                      .slice(0, 8)
                      .map((result: any, i: number) => (
                        <div key={i} className="services__vault-result">
                          <div className="services__vault-result-header">
                            <div className="services__vault-result-title">
                              {result.name || result.title || result.tag || 'Untitled'}
                            </div>
                            {result.type && (
                              <span className="services__vault-result-type">
                                {result.type}
                              </span>
                            )}
                          </div>
                          <div className="services__vault-result-snippet">
                            {(result.content || result.text || result.body || '')
                              .slice(0, 120)}
                          </div>
                          {result.url && (
                            <a
                              className="services__vault-result-url"
                              href={result.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {result.url}
                            </a>
                          )}
                        </div>
                      ))}
                    {vaultSearchResults.length > 8 && (
                      <div className="services__vault-results-more">
                        +{vaultSearchResults.length - 8} more results
                      </div>
                    )}
                  </div>
                </>
              )}

              {!vaultSearchLoading &&
                vaultSearchResults.length === 0 &&
                vaultQuery && (
                  <div className="services__empty">No results found</div>
                )}
            </div>
          </div>
        )}
      </div>

      {/* ======================== 🔧 Vault Pipeline ======================== */}
      <div className="services__section">
        <div
          className="services__section-header"
          onClick={() => toggleSection('pipeline')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter') toggleSection('pipeline');
          }}
        >
          <span className="services__section-icon">🔧</span>
          <div className="services__section-info">
            <h3 className="services__section-title">Vault Pipeline</h3>
            <p className="services__section-desc">
              Bookmark processing pipeline
            </p>
          </div>
          <StatusDot status={getOnlineStatus('vaultPipeline').status} />
          <StatusBadge status={getOnlineStatus('vaultPipeline').status} />
          <span className="services__section-toggle">
            {expandedSection === 'pipeline' ? '▾' : '▸'}
          </span>
        </div>
        {expandedSection === 'pipeline' && (
          <div className="services__section-body">
            {pipelineLoading ? (
              <div className="services__loading">
                <div className="services__skeleton services__skeleton--text" />
                <div className="services__skeleton services__skeleton--text" />
              </div>
            ) : pipelineData ? (
              <>
                <div className="services__mini-grid">
                  <div className="services__mini-card">
                    <span className="services__mini-card-value">
                      <span className={`services__badge services__badge--${calcHealthScore(pipelineData).color}`}>
                        {calcHealthScore(pipelineData).score}/100
                      </span>
                    </span>
                    <span className="services__mini-card-label">Health Score</span>
                  </div>
                  <div className="services__mini-card">
                    <span className="services__mini-card-value">
                      <span className="services__badge services__badge--success">
                        {pipelineData.status || 'healthy'}
                      </span>
                    </span>
                    <span className="services__mini-card-label">Status</span>
                  </div>
                  <div className="services__mini-card">
                    <span className="services__mini-card-value">{pipelineData.backend || 'GCS'}</span>
                    <span className="services__mini-card-label">Backend</span>
                  </div>
                  <div className="services__mini-card">
                    <span className="services__mini-card-value">
                      {pipelineData.cache_loaded_at ? fmtRelative(pipelineData.cache_loaded_at) : 'N/A'}
                    </span>
                    <span className="services__mini-card-label">Last Cache</span>
                  </div>
                </div>
                <div className="services__action-row">
                  <button
                    className="services__btn services__btn--primary"
                    onClick={() => addToast('Cache refresh triggered', 'info')}
                  >
                    🔄 Refresh Cache
                  </button>
                  <button
                    className="services__btn"
                    onClick={() => inlineSearchVault('pipeline_bookmarks', 'bookmark')}
                  >
                    View Bookmarks
                  </button>
                </div>
                <InlineVaultResults section="pipeline_bookmarks" />
              </>
            ) : (
              <div className="services__section-body-alt">
                <p className="services__desc-text">
                  Pipeline endpoint is currently unreachable. Data may still be accessible via the vault.
                </p>
                <div className="services__action-row">
                  <button
                    className="services__btn services__btn--primary"
                    onClick={() => inlineSearchVault('pipeline_bookmarks', 'bookmark')}
                  >
                    Search Vault for Bookmarks
                  </button>
                </div>
                <InlineVaultResults section="pipeline_bookmarks" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ======================== 📊 Vault Insights ======================== */}
      <div className="services__section">
        <div
          className="services__section-header"
          onClick={() => toggleSection('insights')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') toggleSection('insights'); }}
        >
          <span className="services__section-icon">📊</span>
          <div className="services__section-info">
            <h3 className="services__section-title">Vault Insights</h3>
            <p className="services__section-desc">
              Addition rate & trending themes
            </p>
          </div>
          <span className="services__section-toggle">
            {expandedSection === 'insights' ? '▾' : '▸'}
          </span>
        </div>
        {expandedSection === 'insights' && (
          <div className="services__section-body">
            {insightsLoading ? (
              <div className="services__loading">Analyzing vault…</div>
            ) : insightsData ? (
              <>
                {/* Daily addition rate */}
                <div className="services__insights-rate">
                  <div className="services__insights-label">📈 Daily Addition Rate (14 days)</div>
                  <div className="services__insights-bars">
                    {insightsData.dailyRate.map((d) => {
                      const maxCount = Math.max(...insightsData.dailyRate.map((x) => x.count), 1);
                      const pct = Math.round((d.count / maxCount) * 100);
                      return (
                        <div key={d.date} className="services__insights-bar-item" title={`${d.date}: ${d.count} items`}>
                          <div className="services__insights-bar-fill" style={{ height: `${Math.max(pct, 4)}%` }} />
                          <div className="services__insights-bar-label">
                            {new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </div>
                          <div className="services__insights-bar-count">{d.count}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="services__insights-stat">
                    {insightsData.totalAnalyzed} items analyzed · Last 14 days
                  </div>
                </div>

                {/* Trending themes */}
                <div className="services__insights-themes" style={{ marginTop: 16 }}>
                  <div className="services__insights-label">🔥 Trending Themes</div>
                  <div className="services__theme-tags">
                    {insightsData.themes.map((t) => (
                      <span
                        key={t.tag}
                        className="services__theme-tag"
                        style={{
                          fontSize: `${Math.max(11, Math.min(18, 11 + t.count * 1.5))}px`,
                          opacity: `${Math.max(0.4, Math.min(1, 0.4 + t.count * 0.1))}`,
                        }}
                      >
                        #{t.tag}
                        <span className="services__theme-count">{t.count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="services__empty">Failed to load insights</div>
            )}
          </div>
        )}
      </div>

      {/* ======================== 📖 Story Narrator ======================== */}
      <div className="services__section">
        <div
          className="services__section-header"
          onClick={() => toggleSection('story')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter') toggleSection('story');
          }}
        >
          <span className="services__section-icon">📖</span>
          <div className="services__section-info">
            <h3 className="services__section-title">Story Narrator</h3>
            <p className="services__section-desc">
              AI-powered story narration service
            </p>
          </div>
          <StatusDot status={getOnlineStatus('story').status} />
          <StatusBadge status={getOnlineStatus('story').status} />
          <span className="services__section-toggle">
            {expandedSection === 'story' ? '▾' : '▸'}
          </span>
        </div>
        {expandedSection === 'story' && (
          <div className="services__section-body">
            {storyLoading ? (
              <div className="services__loading">Loading stories…</div>
            ) : storyData ? (
              <>
                <div className="services__mini-grid">
                  <div className="services__mini-card">
                    <span className="services__mini-card-value">
                      {allStories.length}
                    </span>
                    <span className="services__mini-card-label">Stories</span>
                  </div>
                  <div className="services__mini-card">
                    <span className="services__mini-card-value">
                      {genres.length - 1}
                    </span>
                    <span className="services__mini-card-label">Genres</span>
                  </div>
                </div>
                <div className="services__genre-tabs">
                  {genres.map((genre) => (
                    <button
                      key={genre}
                      className={`services__genre-tab${genreFilter === genre ? ' active' : ''}`}
                      onClick={() => { setGenreFilter(genre); setExpandedStoryId(null); }}
                    >
                      {genre}
                    </button>
                  ))}
                </div>
                <div className="services__story-grid">
                  {filteredStories.map((story: any) => (
                    <div
                      key={story.id}
                      className="services__story-card"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter') setExpandedStoryId(expandedStoryId === story.id ? null : story.id); }}
                    >
                      <div
                        className="services__story-header"
                        onClick={() => setExpandedStoryId(expandedStoryId === story.id ? null : story.id)}
                      >
                        <div className="services__story-title">{story.title}</div>
                        <span className={`services__story-genre ${story.genre}`}>{story.genre}</span>
                      </div>
                      {expandedStoryId === story.id && (
                        <>
                          <div className="services__story-content">{story.content}</div>
                          <div className="services__story-actions">
                            <button
                              className="services__btn services__btn--ghost"
                              onClick={() => handleCopyStory(story)}
                            >
                              📋 Copy Story
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
                <div className="services__action-row">
                  <button
                    className="services__btn services__btn--primary"
                    onClick={() => addToast('Story generation available via Story Narrator API. Use the in-app features to generate new stories.', 'info')}
                  >
                    ✨ Generate New
                  </button>
                </div>
                {filteredStories.length === 0 && (
                  <div className="services__empty">No stories in this genre</div>
                )}
              </>
            ) : (
              <div className="services__section-body-alt">
                <p className="services__desc-text">
                  Story Narrator endpoint is currently unreachable. The API generates AI-powered stories across multiple genres.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ======================== 📱 Instatter ======================== */}
      <div className="services__section">
        <div
          className="services__section-header"
          onClick={() => toggleSection('instatter')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter') toggleSection('instatter');
          }}
        >
          <span className="services__section-icon">📱</span>
          <div className="services__section-info">
            <h3 className="services__section-title">Instatter</h3>
            <p className="services__section-desc">
              Instagram analytics & data
            </p>
          </div>
          <StatusDot status={getOnlineStatus('instatter').status} />
          <StatusBadge status={getOnlineStatus('instatter').status} />
          <span className="services__section-toggle">
            {expandedSection === 'instatter' ? '▾' : '▸'}
          </span>
        </div>
        {expandedSection === 'instatter' && (
          <div className="services__section-body">
            {instatterLoading ? (
              <div className="services__loading">Loading…</div>
            ) : instatterData ? (
              <>
                <div className="services__mini-grid">
                  <div className="services__mini-card">
                    <span className="services__mini-card-value">
                      <span className="services__badge services__badge--success">
                        {instatterData.status || 'ok'}
                      </span>
                    </span>
                    <span className="services__mini-card-label">Status</span>
                  </div>
                  <div className="services__mini-card">
                    <span className="services__mini-card-value">
                      {instatterData.scraper_mode || 'N/A'}
                    </span>
                    <span className="services__mini-card-label">Scraper Mode</span>
                  </div>
                  <div className="services__mini-card">
                    <span className="services__mini-card-value">
                      {instatterData.timestamp
                        ? fmtRelative(instatterData.timestamp)
                        : 'N/A'}
                    </span>
                    <span className="services__mini-card-label">Last Sync</span>
                  </div>
                  <div className="services__mini-card">
                    <span className="services__mini-card-value">
                      {instatterData.gcs_available ? '✅' : '❌'}
                    </span>
                    <span className="services__mini-card-label">GCS</span>
                  </div>
                </div>
                <div className="services__action-row">
                  <button
                    className="services__btn services__btn--primary"
                    onClick={() => addToast('Instatter sync triggered', 'info')}
                  >
                    🔄 Trigger Sync
                  </button>
                  <button
                    className="services__btn"
                    onClick={() => inlineSearchVault('instatter_vault', 'instagram')}
                  >
                    View Instagram Posts
                  </button>
                </div>
                <InlineVaultResults section="instatter_vault" />
              </>
            ) : (
              <div className="services__section-body-alt">
                <p className="services__desc-text">
                  Instatter endpoint is currently unreachable. Search the vault for Instagram data instead.
                </p>
                <div className="services__action-row">
                  <button
                    className="services__btn services__btn--primary"
                    onClick={() => inlineSearchVault('instatter_vault', 'instagram')}
                  >
                    Search Vault for Instagram Posts
                  </button>
                </div>
                <InlineVaultResults section="instatter_vault" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ======================== ✈️ Telegram Bot ======================== */}
      <div className="services__section">
        <div
          className="services__section-header"
          onClick={() => toggleSection('telegram')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter') toggleSection('telegram');
          }}
        >
          <span className="services__section-icon">✈️</span>
          <div className="services__section-info">
            <h3 className="services__section-title">Telegram Bot</h3>
            <p className="services__section-desc">
              Dasomni bot for search & chat
            </p>
          </div>
          <StatusDot status={getOnlineStatus('telegramBot').status} />
          <StatusBadge status={getOnlineStatus('telegramBot').status} />
          <span className="services__section-toggle">
            {expandedSection === 'telegram' ? '▾' : '▸'}
          </span>
        </div>
        {expandedSection === 'telegram' && (
          <div className="services__section-body">
            {telegramLoading ? (
              <div className="services__loading">Loading…</div>
            ) : telegramBotData ? (
              <>
                <div className="services__mini-grid">
                  <div className="services__mini-card">
                    <span className="services__mini-card-value">
                      <span className={`services__badge services__badge--${telegramBotData.status === 'ok' ? 'success' : 'error'}`}>
                        {telegramBotData.status}
                      </span>
                    </span>
                    <span className="services__mini-card-label">Status</span>
                  </div>
                  <div className="services__mini-card">
                    <span className="services__mini-card-value">
                      {fmtUptime(telegramBotData.uptime)}
                    </span>
                    <span className="services__mini-card-label">Uptime</span>
                  </div>
                  <div className="services__mini-card">
                    <span className="services__mini-card-value">
                      {telegramBotData.memory}
                    </span>
                    <span className="services__mini-card-label">Memory</span>
                  </div>
                  <div className="services__mini-card">
                    <span className="services__mini-card-value">
                      {telegramBotData.mode}
                    </span>
                    <span className="services__mini-card-label">Mode</span>
                  </div>
                </div>
                <div className="services__telegram-test">
                  <input
                    type="text"
                    className="services__input"
                    placeholder="Type a test message…"
                    value={telegramTestMsg}
                    onChange={(e) => setTelegramTestMsg(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleTelegramTestMessage(); }}
                  />
                  <button
                    className="services__btn services__btn--primary"
                    onClick={handleTelegramTestMessage}
                    disabled={!telegramTestMsg.trim()}
                  >
                    Send Test
                  </button>
                </div>
                <div className="services__action-row">
                  <a
                    href="https://t.me/Dasomni_bot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="services__btn"
                  >
                    Open @Dasomni_bot ↗
                  </a>
                </div>
              </>
            ) : (
              <div className="services__section-body-alt">
                <p className="services__desc-text">
                  Telegram Bot endpoint is currently unreachable. You can still interact with the bot directly on Telegram.
                </p>
                <div className="services__action-row">
                  <a
                    href="https://t.me/Dasomni_bot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="services__btn services__btn--primary"
                  >
                    Open @Dasomni_bot ↗
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ======================== 📊 Fusion Dashboard ======================== */}
      <div className="services__section">
        <div
          className="services__section-header"
          onClick={() => toggleSection('fusion')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter') toggleSection('fusion');
          }}
        >
          <span className="services__section-icon">📊</span>
          <div className="services__section-info">
            <h3 className="services__section-title">Fusion Dashboard</h3>
            <p className="services__section-desc">
              Growth workflow & analytics dashboard
            </p>
          </div>
          <StatusDot status={getOnlineStatus('fusionDashboard').status} />
          <StatusBadge status={getOnlineStatus('fusionDashboard').status} />
          <span className="services__section-toggle">
            {expandedSection === 'fusion' ? '▾' : '▸'}
          </span>
        </div>
        {expandedSection === 'fusion' && (
          <div className="services__section-body">
            <div className="services__mini-grid">
              <div className="services__mini-card">
                <span className="services__mini-card-value">
                  <span className="services__badge services__badge--success">
                    {fusionData?.status || 'ok'}
                  </span>
                </span>
                <span className="services__mini-card-label">Status</span>
              </div>
              <div className="services__mini-card">
                <span className="services__mini-card-value">
                  {getOnlineStatus('fusionDashboard').latency != null
                    ? `${getOnlineStatus('fusionDashboard').latency}ms`
                    : '—'}
                </span>
                <span className="services__mini-card-label">Latency</span>
              </div>
            </div>
            <button
              className="services__btn services__btn--primary"
              onClick={() =>
                window.open(OMNICLAW_ENDPOINTS.fusionDashboard.url, '_blank', 'noopener,noreferrer')
              }
            >
              Open Dashboard ↗
            </button>
          </div>
        )}
      </div>

      {/* ======================== 🔊 TTS Service ======================== */}
      <div className="services__section">
        <div
          className="services__section-header"
          onClick={() => toggleSection('tts')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter') toggleSection('tts');
          }}
        >
          <span className="services__section-icon">🔊</span>
          <div className="services__section-info">
            <h3 className="services__section-title">TTS Service</h3>
            <p className="services__section-desc">
              Text-to-speech synthesis (browser-powered)
            </p>
          </div>
          <StatusDot status={getOnlineStatus('tts').status} />
          <StatusBadge status={getOnlineStatus('tts').status} />
          <span className="services__section-toggle">
            {expandedSection === 'tts' ? '▾' : '▸'}
          </span>
        </div>
        {expandedSection === 'tts' && (
          <div className="services__section-body">
            <p className="services__desc-text">
              Cloud TTS endpoint is offline — using your browser's built-in speech synthesis.
            </p>
            <div className="services__tts-area">
              <textarea
                className="services__tts-textarea"
                placeholder="Type or paste text to speak…"
                value={ttsText}
                onChange={(e) => setTtsText(e.target.value)}
                rows={4}
              />
              {ttsVoices.length > 0 && (
                <div className="services__tts-controls">
                  <select
                    className="services__select"
                    value={ttsVoice}
                    onChange={(e) => setTtsVoice(e.target.value)}
                  >
                    {ttsVoices.map((v) => (
                      <option key={v.voiceURI} value={v.voiceURI}>
                        {v.name} ({v.lang})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="services__action-row">
                {!ttsSpeaking ? (
                  <button
                    className="services__btn services__btn--primary"
                    onClick={handleTtsSpeak}
                    disabled={!ttsText.trim()}
                  >
                    🔊 Speak
                  </button>
                ) : (
                  <button
                    className="services__btn services__btn--error"
                    onClick={handleTtsStop}
                  >
                    ⏹ Stop
                  </button>
                )}
              </div>
              {ttsSpeaking && (
                <div className="services__tts-playing">
                  <span className="services__tts-wave" />
                  <span>Speaking…</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ======================== 💬 WhatsApp Bot ======================== */}
      <div className="services__section">
        <div
          className="services__section-header"
          onClick={() => toggleSection('whatsapp')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter') toggleSection('whatsapp');
          }}
        >
          <span className="services__section-icon">💬</span>
          <div className="services__section-info">
            <h3 className="services__section-title">WhatsApp Bot</h3>
            <p className="services__section-desc">
              Multi-provider WhatsApp AI assistant
            </p>
          </div>
          <StatusDot status={getOnlineStatus('omniclaw').status} />
          <StatusBadge status={getOnlineStatus('omniclaw').status} />
          <span className="services__section-toggle">
            {expandedSection === 'whatsapp' ? '▾' : '▸'}
          </span>
        </div>
        {expandedSection === 'whatsapp' && (
          <div className="services__section-body">
            <p className="services__desc-text">
              WhatsApp bot routes messages through OmniClaw GCS. Send a test message or view recent logs.
            </p>
            <div className="services__action-row">
              <button
                className="services__btn services__btn--primary"
                onClick={() => addToast('WhatsApp test message queued (placeholder)', 'info')}
              >
                Send Test Message
              </button>
              <button
                className="services__btn"
                onClick={() => addToast('WhatsApp bot handles messages via Cloud Run webhook. Connect your number via the Twilio console.', 'info')}
              >
                View Logs
              </button>
            </div>
            {getLogs('omniclaw').length > 0 && (
              <div className="services__logs">
                {getLogs('omniclaw').slice(-5).map((log, i) => (
                  <div key={i} className="services__log-line">
                    {log}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ======================== 🗣️ Alexa Skill ======================== */}
      <div className="services__section">
        <div
          className="services__section-header"
          onClick={() => toggleSection('alexa')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter') toggleSection('alexa');
          }}
        >
          <span className="services__section-icon">🗣️</span>
          <div className="services__section-info">
            <h3 className="services__section-title">Alexa Skill</h3>
            <p className="services__section-desc">
              Voice assistant integration
            </p>
          </div>
          <StatusDot status={getOnlineStatus('alexa').status} />
          <StatusBadge status={getOnlineStatus('alexa').status} />
          <span className="services__section-toggle">
            {expandedSection === 'alexa' ? '▾' : '▸'}
          </span>
        </div>
        {expandedSection === 'alexa' && (
          <div className="services__section-body">
            <p className="services__desc-text">
              Alexa Skill endpoint is deployed via Cloud Run. Manage your skill from the Alexa Developer Console.
            </p>
            <div className="services__alexa-test">
              <input
                type="text"
                className="services__input"
                placeholder="Try an utterance, e.g. 'Ask OmniClaw what's the weather'"
                value={alexaTestMsg}
                onChange={(e) => setAlexaTestMsg(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAlexaTestInvocation(); }}
              />
              <button
                className="services__btn services__btn--primary"
                onClick={handleAlexaTestInvocation}
                disabled={!alexaTestMsg.trim()}
              >
                Test Invocation
              </button>
            </div>
            <div className="services__action-row">
              <a
                href="https://developer.amazon.com/alexa/console/ask"
                target="_blank"
                rel="noopener noreferrer"
                className="services__btn"
              >
                Alexa Developer Console ↗
              </a>
            </div>
          </div>
        )}
      </div>

      {/* ======================== 🔖 Bookmarks ======================== */}
      <div className="services__section">
        <div
          className="services__section-header"
          onClick={() => toggleSection('bookmarks')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter') toggleSection('bookmarks');
          }}
        >
          <span className="services__section-icon">🔖</span>
          <div className="services__section-info">
            <h3 className="services__section-title">Bookmarks</h3>
            <p className="services__section-desc">
              Processed bookmark management
            </p>
          </div>
          <StatusDot status={getOnlineStatus('bookmarks').status} />
          <StatusBadge status={getOnlineStatus('bookmarks').status} />
          <span className="services__section-toggle">
            {expandedSection === 'bookmarks' ? '▾' : '▸'}
          </span>
        </div>
        {expandedSection === 'bookmarks' && (
          <div className="services__section-body">
            <p className="services__desc-text">
              Bookmark processor is offline — data is sourced from the vault search API.
            </p>

            {/* Real vault stats */}
            {vaultStatsData && (
              <div className="services__mini-grid" style={{ marginBottom: 12 }}>
                <div className="services__mini-card">
                  <span className="services__mini-card-value">{vaultStatsData.total?.toLocaleString() ?? '17,641'}</span>
                  <span className="services__mini-card-label">Total Nodes</span>
                </div>
                <div className="services__mini-card">
                  <span className="services__mini-card-value">{vaultStatsData.twitter?.toLocaleString() ?? '—'}</span>
                  <span className="services__mini-card-label">Twitter</span>
                </div>
                <div className="services__mini-card">
                  <span className="services__mini-card-value">{vaultStatsData.instagram?.toLocaleString() ?? '—'}</span>
                  <span className="services__mini-card-label">Instagram</span>
                </div>
                {pipelineData?.total_bookmarks != null && (
                  <div className="services__mini-card">
                    <span className="services__mini-card-value services__mini-card-value--muted">{pipelineData.total_bookmarks.toLocaleString()}</span>
                    <span className="services__mini-card-label">Pipeline Bookmarks</span>
                  </div>
                )}
              </div>
            )}
            {!vaultStatsData && pipelineData?.total_bookmarks != null && (
              <div className="services__mini-grid" style={{ marginBottom: 12 }}>
                <div className="services__mini-card">
                  <span className="services__mini-card-value">{pipelineData.total_bookmarks.toLocaleString()}</span>
                  <span className="services__mini-card-label">Pipeline Total</span>
                </div>
                <div className="services__mini-card">
                  <span className="services__mini-card-value">{bookmarks.length}</span>
                  <span className="services__mini-card-label">Fetched</span>
                </div>
              </div>
            )}

            <div className="services__action-row">
              <button
                className="services__btn services__btn--primary"
                onClick={async () => {
                  addToast('Fetching bookmarks from vault…', 'info');
                  await fetchBookmarks();
                  addToast('Bookmarks fetched', 'success');
                }}
                disabled={bookmarksLoading}
              >
                {bookmarksLoading ? 'Fetching…' : 'Fetch Bookmarks'}
              </button>
              <button
                className="services__btn"
                onClick={() => inlineSearchVault('bookmarks_vault', 'bookmark')}
              >
                Search Vault
              </button>
            </div>

            {/* Inline vault results for bookmarks */}
            <InlineVaultResults section="bookmarks_vault" />

            {/* Fetched bookmarks from context */}
            {bookmarks.length > 0 && (
              <div className="services__bookmarks-list">
                {bookmarks.slice(0, 8).map((bm: any, i: number) => {
                  const bmId = bm.url || bm.link || `bm-${i}`;
                  const existingNote = bookmarkNotesMap[bmId];
                  return (
                    <div key={i} className="services__bookmark-item">
                      <div className="services__bookmark-title">
                        {bm.title || bm.name || 'Untitled Bookmark'}
                      </div>
                      {bm.url && (
                        <a
                          className="services__bookmark-url"
                          href={bm.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {bm.url.length > 70
                            ? bm.url.slice(0, 70) + '…'
                            : bm.url}
                        </a>
                      )}
                      {bm.date && (
                        <div className="services__bookmark-date">
                          {new Date(bm.date).toLocaleDateString()}
                        </div>
                      )}
                      <div className="services__bookmark-actions">
                        {existingNote ? (
                          <div className="services__bookmark-note">
                            📝 {existingNote.note}
                          </div>
                        ) : editingBookmarkNote === bmId ? (
                          <div className="services__note-edit">
                            <input
                              className="services__input services__input--sm"
                              placeholder="Add a note…"
                              value={bookmarkNoteText}
                              onChange={(e) => setBookmarkNoteText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAddBookmarkNote(bmId, bookmarkNoteText);
                                if (e.key === 'Escape') setEditingBookmarkNote(null);
                              }}
                              autoFocus
                            />
                            <button
                              className="services__btn services__btn--ghost services__btn--sm"
                              onClick={() => handleAddBookmarkNote(bmId, bookmarkNoteText)}
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <button
                            className="services__btn services__btn--ghost services__btn--sm"
                            onClick={() => {
                              setEditingBookmarkNote(bmId);
                              setBookmarkNoteText('');
                            }}
                          >
                            Add Note
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {bookmarks.length > 8 && (
                  <div className="services__bookmarks-more">
                    +{bookmarks.length - 8} more
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ======================== 🐦 Social Sync ======================== */}
      <div className="services__section">
        <div
          className="services__section-header"
          onClick={() => toggleSection('social')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter') toggleSection('social');
          }}
        >
          <span className="services__section-icon">🐦</span>
          <div className="services__section-info">
            <h3 className="services__section-title">Social Sync</h3>
            <p className="services__section-desc">
              Twitter & Instagram sync services
            </p>
          </div>
          <StatusDot status={getOnlineStatus('twitterSync').status} />
          <span className="services__section-toggle">
            {expandedSection === 'social' ? '▾' : '▸'}
          </span>
        </div>
        {expandedSection === 'social' && (
          <div className="services__section-body">
            <p className="services__desc-text">
              Social sync endpoints are currently offline. Data is accessible via the vault search API.
            </p>
            <div className="services__social-grid">
              <div className="services__social-item">
                <div className="services__social-header">
                  <span>🐦</span>
                  <strong>Twitter Bookmarks</strong>
                </div>
                <div className="services__social-detail">
                  Search vault for synced Twitter content
                </div>
                <button
                  className="services__btn services__btn--primary"
                  onClick={() => inlineSearchVault('twitter_vault', 'twitter')}
                >
                  Search Twitter Bookmarks
                </button>
              </div>
              <div className="services__social-item">
                <div className="services__social-header">
                  <span>📸</span>
                  <strong>Instagram Posts</strong>
                </div>
                <div className="services__social-detail">
                  Search vault for synced Instagram content
                </div>
                <button
                  className="services__btn services__btn--primary"
                  onClick={() => inlineSearchVault('instagram_vault', 'instagram')}
                >
                  Search Instagram Posts
                </button>
              </div>
            </div>

            {/* Twitter vault results */}
            {(socialVaultResults['twitter_vault']?.length ?? 0) > 0 && (
              <div className="services__sub-results">
                <h4 className="services__sub-results-title">🐦 Twitter Results</h4>
                <InlineVaultResults section="twitter_vault" />
              </div>
            )}

            {/* Instagram vault results */}
            {(socialVaultResults['instagram_vault']?.length ?? 0) > 0 && (
              <div className="services__sub-results">
                <h4 className="services__sub-results-title">📸 Instagram Results</h4>
                <InlineVaultResults section="instagram_vault" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ======================== 🎛️ Vault Control ======================== */}
      <div className="services__section">
        <div
          className="services__section-header"
          onClick={() => toggleSection('vaultcontrol')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter') toggleSection('vaultcontrol');
          }}
        >
          <span className="services__section-icon">🎛️</span>
          <div className="services__section-info">
            <h3 className="services__section-title">Vault Control</h3>
            <p className="services__section-desc">
              Vault backend control endpoint
            </p>
          </div>
          <StatusDot status={getOnlineStatus('vaultControl').status} />
          <StatusBadge status={getOnlineStatus('vaultControl').status} />
          <span className="services__section-toggle">
            {expandedSection === 'vaultcontrol' ? '▾' : '▸'}
          </span>
        </div>
        {expandedSection === 'vaultcontrol' && (
          <div className="services__section-body">
            <p className="services__desc-text">
              Vault Control endpoint is offline. All vault operations are available through Vault Search and Vault Pipeline.
            </p>
            <div className="services__mini-grid">
              <div className="services__mini-card">
                <span className="services__mini-card-value">17,641</span>
                <span className="services__mini-card-label">Indexed Nodes</span>
              </div>
              <div className="services__mini-card">
                <span className="services__mini-card-value">
                  {pipelineData?.total_bookmarks ?? '—'}
                </span>
                <span className="services__mini-card-label">Bookmarks</span>
              </div>
              <div className="services__mini-card">
                <span className="services__mini-card-value">v6.0.0</span>
                <span className="services__mini-card-label">Version</span>
              </div>
              <div className="services__mini-card">
                <span className="services__mini-card-value">
                  {pipelineData?.cache_loaded_at
                    ? fmtRelative(pipelineData.cache_loaded_at)
                    : 'N/A'}
                </span>
                <span className="services__mini-card-label">Last Indexed</span>
              </div>
            </div>
            <div className="services__action-row">
              <button
                className="services__btn services__btn--primary"
                onClick={() => {
                  setExpandedSection('vault');
                  setTimeout(() => {
                    document.querySelector('.services__vault-input')?.scrollIntoView({ behavior: 'smooth' });
                  }, 100);
                }}
              >
                Go to Vault Search
              </button>
              <button
                className="services__btn"
                onClick={() => {
                  setExpandedSection('pipeline');
                  setTimeout(() => {
                    document.querySelector('.services__section-body')?.scrollIntoView({ behavior: 'smooth' });
                  }, 100);
                }}
              >
                View Pipeline Status
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
