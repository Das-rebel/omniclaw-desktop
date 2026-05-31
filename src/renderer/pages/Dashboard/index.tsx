import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useOmniClaw,
  OMNICLAW_ENDPOINTS,
  AVAILABLE_PROVIDERS,
} from '../../context/OmniClawContext';
import { useToasts } from '../../context/ToastsContext';
import './Dashboard.scss';

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

export default function Dashboard() {
  const navigate = useNavigate();
  const {
    conversations,
    apiKeys,
    endpointStatuses,
    checkAllEndpoints,
    lastChecked,
    vaultSearchResults,
    vaultSearchLoading,
    searchVault,
    fetchBookmarks,
    providerHealth,
    checkProviderHealth,
    serviceLogs,
  } = useOmniClaw();
  const { addToast } = useToasts();

  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Quick Chat state
  const [quickChatMsg, setQuickChatMsg] = useState('');
  const quickChatRef = useRef<HTMLInputElement>(null);

  // Live data previews
  const [pipelinePreview, setPipelinePreview] = useState<string | null>(null);
  const [vaultPreview, setVaultPreview] = useState<string | null>(null);
  const [telegramPreview, setTelegramPreview] = useState<string | null>(null);
  const [instatterPreview, setInstatterPreview] = useState<string | null>(null);

  // Notebook stats
  const [notebookStats, setNotebookStats] = useState<{
    collections: number;
    notes: number;
    recentNotes: { id: string; title: string; updatedAt: number }[];
  }>({ collections: 0, notes: 0, recentNotes: [] });

  // Activity feed
  const [activityItems, setActivityItems] = useState<
    { icon: string; text: string; time: string; badge: string }[]
  >([]);

  const loadNotebookStats = useCallback(async () => {
    try {
      const [cols, ns] = await Promise.all([
        window.electron.collections.list() as Promise<any[]>,
        window.electron.notes.list() as Promise<any[]>,
      ]);
      const recentNotes = (ns || [])
        .sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0))
        .slice(0, 5)
        .map((n: any) => ({ id: n.id, title: n.title, updatedAt: n.updatedAt }));
      setNotebookStats({
        collections: (cols || []).length,
        notes: (ns || []).length,
        recentNotes,
      });
    } catch {
      // Not available yet
    }
  }, []);

  // Fetch live preview data for endpoint cards
  const loadPreviews = useCallback(async () => {
    const [pipelineData, vaultData, telegramData, instatterData, vaultStats] = await Promise.all([
      fetchJson(OMNICLAW_ENDPOINTS.vaultPipeline.url),
      fetchJson(OMNICLAW_ENDPOINTS.vaultSearch.url),
      fetchJson(OMNICLAW_ENDPOINTS.telegramBot.url),
      fetchJson(OMNICLAW_ENDPOINTS.instatter.url),
      fetchJson(`${OMNICLAW_ENDPOINTS.vaultSearch.url}/stats`),
    ]);
    if (vaultStats?.twitter != null) {
      setPipelinePreview(`${vaultStats.twitter.toLocaleString()} tweets · ${vaultStats.instagram?.toLocaleString() ?? 0} insta`);
    } else if (pipelineData?.total_bookmarks != null) {
      setPipelinePreview(`${pipelineData.total_bookmarks} bookmarks`);
    }
    if (vaultStats?.total != null) {
      setVaultPreview(`${vaultStats.total.toLocaleString()} nodes · ${vaultStats.unique_terms?.toLocaleString() ?? '?'} terms`);
    } else if (vaultData?.nodes != null) {
      setVaultPreview(`${vaultData.nodes} nodes`);
    } else if (vaultData?.index_built) {
      setVaultPreview(`v${vaultData.version || '?'} · index ready`);
    }
    if (telegramData?.uptime != null) {
      const seconds = telegramData.uptime;
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const uptimeStr = h > 0 ? `${h}h ${m}m` : `${m}m`;
      setTelegramPreview(`${uptimeStr} uptime`);
    }
    if (instatterData?.status) {
      setInstatterPreview(instatterData.status);
    }
  }, []);

  // Build activity feed from service logs
  const loadActivityFeed = useCallback(() => {
    const entries = Object.entries(serviceLogs);
    if (entries.length === 0) {
      setActivityItems([
        { icon: '🔍', text: 'Vault Search: ready', time: 'now', badge: 'Ready' },
        { icon: '🔧', text: 'Vault Pipeline: cache ready', time: 'now', badge: 'Active' },
        { icon: '✈️', text: 'Telegram Bot: handling requests', time: 'now', badge: 'Listening' },
        { icon: '📊', text: 'Fusion Dashboard: operational', time: 'now', badge: 'Online' },
      ]);
      return;
    }

    const items: { icon: string; text: string; time: string; badge: string }[] = [];
    const iconMap: Record<string, string> = {
      vaultSearch: '🔍',
      vaultPipeline: '🔧',
      telegramBot: '✈️',
      instatter: '📱',
      story: '📖',
      tts: '🔊',
      omniclaw: '💬',
      fusionDashboard: '📊',
      bookmarks: '🔖',
      twitterSync: '🐦',
      instagram: '📸',
      alexa: '🗣️',
      vaultControl: '🎛️',
      chat: '💬',
    };

    const nameMap: Record<string, string> = {
      vaultSearch: 'Vault Search',
      vaultPipeline: 'Vault Pipeline',
      telegramBot: 'Telegram Bot',
      instatter: 'Instatter',
      story: 'Story Narrator',
      tts: 'TTS Service',
      omniclaw: 'WhatsApp Bot',
      fusionDashboard: 'Fusion Dashboard',
      bookmarks: 'Bookmarks',
      twitterSync: 'Twitter Sync',
      instagram: 'Instagram',
      alexa: 'Alexa Skill',
      vaultControl: 'Vault Control',
      chat: 'Chat',
    };

    for (const [serviceId, logs] of entries) {
      const recent = logs.slice(-3);
      for (const log of recent) {
        // Parse timestamp from log format "[HH:MM:SS] message"
        const match = log.match(/\[(\d{2}:\d{2}:\d{2})\]\s*(.*)/);
        const time = match ? match[1] : '—';
        const text = match
          ? `${nameMap[serviceId] || serviceId}: ${match[2]}`
          : `${nameMap[serviceId] || serviceId}: ${log}`;
        items.push({
          icon: iconMap[serviceId] || '📌',
          text,
          time,
          badge: 'Log',
        });
      }
    }

    setActivityItems(items.slice(-8));
  }, [serviceLogs]);

  useEffect(() => {
    checkAllEndpoints();
    checkProviderHealth();
    loadNotebookStats();
    loadPreviews();

    // Auto-refresh every 60s
    const interval = setInterval(() => {
      checkAllEndpoints();
      checkProviderHealth();
      loadPreviews();
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadActivityFeed();
  }, [serviceLogs, loadActivityFeed]);

  const totalMessages = conversations.reduce(
    (sum, c) => sum + (c.messages?.length || 0),
    0
  );
  const convCount = conversations.length;

  // Provider health counts
  const onlineProviderCount = Object.values(providerHealth).filter(
    (s) => s === 'online'
  ).length;

  const handleUnifiedSearch = async () => {
    if (!searchQuery.trim()) return;
    await searchVault(searchQuery.trim());
    setShowSearchResults(true);
  };

  const handleQuickChatSend = () => {
    if (!quickChatMsg.trim()) return;
    // Store message BEFORE navigating so Chat page can read it
    sessionStorage.setItem('quickChatMessage', quickChatMsg.trim());
    navigate('/');
    setQuickChatMsg('');
  };

  const onlineCount = Object.values(endpointStatuses).filter(
    (s) => s.status === 'online'
  ).length;
  const totalEndpoints = Object.keys(endpointStatuses).length;

  // Key services for mini-cards
  const keyServices = [
    {
      id: 'vaultSearch',
      name: 'Vault',
      icon: '🔍',
      metric: '17.6k nodes',
      metricLabel: 'nodes',
      route: '/services',
    },
    {
      id: 'vaultPipeline',
      name: 'Pipeline',
      icon: '🔧',
      metric: pipelinePreview?.replace(' bookmarks', '') || '1.3k',
      metricLabel: 'bookmarks',
      route: '/services',
    },
    {
      id: 'story',
      name: 'Story',
      icon: '📖',
      metric: '3',
      metricLabel: 'stories',
      route: '/services',
    },
    {
      id: 'telegramBot',
      name: 'Telegram',
      icon: '✈️',
      metric: telegramPreview?.replace(' uptime', '') || '240s',
      metricLabel: 'uptime',
      route: '/services',
    },
  ];

  return (
    <div className="dashboard">
      {/* ── Unified Search Bar ── */}
      <div className="dashboard__search">
        <span className="dashboard__search-icon">🔍</span>
        <input
          type="text"
          className="dashboard__search-input"
          placeholder="Search vault, bookmarks, services…"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (!e.target.value.trim()) {
              setShowSearchResults(false);
            }
          }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleUnifiedSearch(); }}
        />
        <button
          className="dashboard__search-btn"
          onClick={handleUnifiedSearch}
          disabled={vaultSearchLoading || !searchQuery.trim()}
        >
          {vaultSearchLoading ? '…' : 'Search'}
        </button>
      </div>

      {/* Search results dropdown */}
      {showSearchResults && vaultSearchResults.length > 0 && (
        <div className="dashboard__search-results">
          <div className="dashboard__search-results-header">
            <span>Search Results</span>
            <button
              className="dashboard__search-results-close"
              onClick={() => setShowSearchResults(false)}
            >
              ✕
            </button>
          </div>
          {vaultSearchResults.slice(0, 6).map((result: any, i: number) => (
            <div key={i} className="dashboard__search-result-item">
              <div className="dashboard__search-result-title">
                {result.name || result.title || result.tag || 'Untitled'}
              </div>
              <div className="dashboard__search-result-snippet">
                {(result.content || result.text || result.body || '').slice(0, 100)}
              </div>
            </div>
          ))}
          {vaultSearchResults.length > 6 && (
            <div className="dashboard__search-results-more">
              +{vaultSearchResults.length - 6} more results —{' '}
              <a onClick={() => { navigate('/services'); setShowSearchResults(false); }} style={{ cursor: 'pointer', color: 'var(--accent)' }}>
                see all
              </a>
            </div>
          )}
        </div>
      )}

      {/* ── Quick Stat Cards ── */}
      <div className="dashboard__quick-stats">
        <div
          className="dashboard__quick-stat"
          onClick={() => navigate('/')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') navigate('/'); }}
        >
          <span className="dashboard__quick-stat-icon">💬</span>
          <div className="dashboard__quick-stat-info">
            <span className="dashboard__quick-stat-value">{convCount}</span>
            <span className="dashboard__quick-stat-label">conversations</span>
          </div>
          <span className="dashboard__quick-stat-arrow">→</span>
        </div>
        <div
          className="dashboard__quick-stat"
          onClick={() => navigate('/services')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') navigate('/services'); }}
        >
          <span className="dashboard__quick-stat-icon">🔌</span>
          <div className="dashboard__quick-stat-info">
            <span className="dashboard__quick-stat-value">
              {onlineCount}/{totalEndpoints}
            </span>
            <span className="dashboard__quick-stat-label">services online</span>
          </div>
          <span className="dashboard__quick-stat-arrow">→</span>
        </div>
        <div
          className="dashboard__quick-stat"
          onClick={() => navigate('/notebook')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') navigate('/notebook'); }}
        >
          <span className="dashboard__quick-stat-icon">📓</span>
          <div className="dashboard__quick-stat-info">
            <span className="dashboard__quick-stat-value">{notebookStats.notes}</span>
            <span className="dashboard__quick-stat-label">notes</span>
          </div>
          <span className="dashboard__quick-stat-arrow">→</span>
        </div>
      </div>

      {/* ── Service Mini Cards ── */}
      <div className="dashboard__section">
        <div className="dashboard__section-header">
          <h2 className="dashboard__section-title">Services</h2>
          <a href="#/services" className="dashboard__section-link">
            View All →
          </a>
        </div>
        <div className="dashboard__service-minis">
          {keyServices.map((svc) => {
            const status = endpointStatuses[svc.id];
            const isOnline = status?.status === 'online';
            return (
              <div
                key={svc.id}
                className="dashboard__service-mini"
                onClick={() => navigate('/services')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') navigate('/services'); }}
              >
                <div className="dashboard__service-mini-top">
                  <span className="dashboard__service-mini-icon">{svc.icon}</span>
                  <span
                    className={`dashboard__service-mini-dot dashboard__service-mini-dot--${status?.status || 'unknown'}`}
                  />
                </div>
                <div className="dashboard__service-mini-name">{svc.name}</div>
                <div className="dashboard__service-mini-metric">
                  <span className="dashboard__service-mini-value">{svc.metric}</span>
                  <span className="dashboard__service-mini-label">{svc.metricLabel}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Quick Chat ── */}
      <div className="dashboard__section">
        <h2 className="dashboard__section-title">Quick Chat</h2>
        <div className="dashboard__quick-chat">
          <div className="dashboard__quick-chat-input-row">
            <input
              ref={quickChatRef}
              type="text"
              className="dashboard__quick-chat-input"
              placeholder="Ask anything to multiple models…"
              value={quickChatMsg}
              onChange={(e) => setQuickChatMsg(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleQuickChatSend(); }}
            />
            <button
              className="dashboard__btn dashboard__btn--primary"
              onClick={handleQuickChatSend}
              disabled={!quickChatMsg.trim()}
            >
              Send ↗
            </button>
          </div>

          {/* Provider status strip */}
          <div className="dashboard__provider-strip">
            {AVAILABLE_PROVIDERS.map((provider) => {
              const isOnline = providerHealth[provider.id] === 'online';
              const isConfigured =
                provider.id === 'ollama' || !!apiKeys[provider.id];
              return (
                <div
                  key={provider.id}
                  className="dashboard__provider-chip"
                  title={`${provider.name}: ${isOnline ? 'Online' : 'Offline'} · ${isConfigured ? 'Configured' : 'No key'}`}
                >
                  <span
                    className="dashboard__provider-chip-dot"
                    style={{
                      backgroundColor: isOnline ? '#22c55e' : isConfigured ? '#f59e0b' : '#ef4444',
                    }}
                  />
                  <span className="dashboard__provider-chip-name">
                    {provider.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Activity Feed ── */}
      <div className="dashboard__section">
        <h2 className="dashboard__section-title">Recent Activity</h2>
        <div className="dashboard__activity">
          {activityItems.map((item, i) => (
            <div key={i} className="dashboard__activity-item">
              <span className="dashboard__activity-icon">{item.icon}</span>
              <div className="dashboard__activity-text">{item.text}</div>
              <div className="dashboard__activity-meta">
                <span className="dashboard__activity-time">{item.time}</span>
                <span className="dashboard__badge dashboard__badge--info">
                  {item.badge}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Endpoint Status Grid (compact) ── */}
      <div className="dashboard__section">
        <div className="dashboard__section-header">
          <h2 className="dashboard__section-title">Service Health</h2>
          <span className="dashboard__last-checked">
            {lastChecked
              ? `Last checked: ${new Date(lastChecked).toLocaleTimeString()}`
              : 'Not checked yet'}
          </span>
        </div>
        <div className="dashboard__endpoint-grid-compact">
          {Object.entries(endpointStatuses).slice(0, 8).map(
            ([id, status]) => (
              <div
                key={id}
                className={`dashboard__endpoint-chip dashboard__endpoint-chip--${status.status}`}
                onClick={() => navigate('/services')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') navigate('/services'); }}
              >
                <span className="dashboard__endpoint-chip-dot" />
                <span className="dashboard__endpoint-chip-name">{status.name}</span>
                <span className="dashboard__endpoint-chip-status">
                  {status.status === 'checking'
                    ? '…'
                    : status.status === 'online'
                    ? '✓'
                    : status.status === 'offline'
                    ? '✕'
                    : '?'}
                </span>
              </div>
            )
          )}
          {Object.keys(endpointStatuses).length > 8 && (
            <a href="#/services" className="dashboard__endpoint-chip-more">
              +{Object.keys(endpointStatuses).length - 8} more
            </a>
          )}
        </div>
      </div>

      {/* ── Notebook Preview ── */}
      {notebookStats.recentNotes.length > 0 && (
        <div className="dashboard__section">
          <div className="dashboard__section-header">
            <h2 className="dashboard__section-title">📓 Recent Notes</h2>
            <a href="#/notebook" className="dashboard__section-link">
              View All →
            </a>
          </div>
          <div className="dashboard__activity">
            {notebookStats.recentNotes.map((note) => (
              <div key={note.id} className="dashboard__activity-item">
                <span className="dashboard__activity-icon">📝</span>
                <div className="dashboard__activity-text">
                  <strong>{note.title || 'Untitled'}</strong>
                </div>
                <span className="dashboard__activity-time">
                  {note.updatedAt
                    ? new Date(note.updatedAt).toLocaleDateString()
                    : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
