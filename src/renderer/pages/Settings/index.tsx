import { useState, useEffect } from 'react';
import {
  useOmniClaw,
  AVAILABLE_PROVIDERS,
  OMNICLAW_ENDPOINTS,
} from '../../context/OmniClawContext';
import { useToasts } from '../../context/ToastsContext';
import './Settings.scss';

export default function Settings() {
  const {
    apiKeys,
    setApiKey,
    removeApiKey,
    endpointStatuses,
    checkAllEndpoints,
    lastChecked,
    providerHealth,
    checkProviderHealth,
  } = useOmniClaw();
  const { addToast } = useToasts();
  const [editingKeys, setEditingKeys] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [appVersion, setAppVersion] = useState('');
  const [dataPath, setDataPath] = useState('');

  useEffect(() => {
    // Auto-check provider health when page loads
    checkProviderHealth();

    const loadAppInfo = async () => {
      try {
        const version = await window.electron.app.getVersion();
        setAppVersion(version);
      } catch {
        setAppVersion('unknown');
      }
      try {
        const path = await window.electron.app.getPath('userData');
        setDataPath(path);
      } catch {
        setDataPath('unknown');
      }
    };
    loadAppInfo();
  }, []);

  const handleSave = async (providerId: string) => {
    const key = editingKeys[providerId];
    if (!key || !key.trim()) return;
    try {
      await setApiKey(providerId, key.trim());
      setEditingKeys((prev) => {
        const next = { ...prev };
        delete next[providerId];
        return next;
      });
      addToast(
        `${AVAILABLE_PROVIDERS.find((p) => p.id === providerId)?.name} key saved`,
        'success'
      );
    } catch (err: any) {
      addToast(`Failed to save key: ${err.message}`, 'error');
    }
  };

  const handleRemove = async (providerId: string) => {
    try {
      await removeApiKey(providerId);
      addToast(
        `${AVAILABLE_PROVIDERS.find((p) => p.id === providerId)?.name} key removed`,
        'info'
      );
    } catch (err: any) {
      addToast(`Failed to remove key: ${err.message}`, 'error');
    }
  };

  const handleOpenDataFolder = async () => {
    try {
      await window.electron.shell.openPath(dataPath);
    } catch {
      addToast('Could not open data folder', 'error');
    }
  };

  const handleRefreshEndpoints = async () => {
    addToast('Refreshing service endpoints…', 'info');
    await checkAllEndpoints();
    addToast('Endpoints refreshed', 'success');
  };

  const handleOpenUrl = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="settings">
      <div className="settings__header">
        <h1 className="settings__title">Settings</h1>
        <p className="settings__subtitle">
          Configure your API keys and preferences
        </p>
      </div>

      {/* API Keys */}
      <div className="settings__section">
        <h2 className="settings__section-title">
          API Keys
          <button
            className="settings__btn settings__btn--sm"
            onClick={async () => {
              addToast('Checking provider health…', 'info');
              await checkProviderHealth();
              addToast('Health check complete', 'success');
            }}
            style={{ marginLeft: 12, fontSize: 11 }}
          >
            🔄 Check All
          </button>
        </h2>
        <div className="settings__providers">
          {AVAILABLE_PROVIDERS.map((provider) => {
            const hasExistingKey = !!apiKeys[provider.id];
            const editValue = editingKeys[provider.id] ?? '';
            const isEditing = editingKeys[provider.id] !== undefined;
            const isOllama = provider.id === 'ollama';

            return (
              <div key={provider.id} className="settings__provider">
                <div className="settings__provider-header">
                  <div className="settings__provider-info">
                    <span
                      className="settings__provider-dot"
                      style={{ backgroundColor: provider.color }}
                    />
                    <span className="settings__provider-name">
                      {provider.name}
                    </span>
                  </div>
                  <div className="settings__provider-badge">
                    {isOllama ? (
                      <span className="settings__badge settings__badge--local">Local</span>
                    ) : hasExistingKey ? (
                      <>
                        <span
                          className={`settings__badge settings__badge--${
                            providerHealth[provider.id] === 'online'
                              ? 'success'
                              : providerHealth[provider.id] === 'offline'
                              ? 'error'
                              : 'warning'
                          }`}
                          title={
                            providerHealth[provider.id] === 'online'
                              ? 'API reachable'
                              : providerHealth[provider.id] === 'offline'
                              ? 'API unreachable'
                              : 'Not tested'
                          }
                        >
                          {providerHealth[provider.id] === 'online'
                            ? '✅ Ready'
                            : providerHealth[provider.id] === 'offline'
                            ? '❌ Failed'
                            : '⚠ Unknown'}
                        </span>
                      </>
                    ) : (
                      <span className="settings__badge settings__badge--warning">No key</span>
                    )}
                  </div>
                </div>

                <div className="settings__provider-models">
                  {provider.models.map((m) => (
                    <span key={m} className="settings__model-chip">
                      {m}
                    </span>
                  ))}
                </div>

                {!isOllama && (
                  <div className="settings__provider-key">
                    {isEditing || !hasExistingKey ? (
                      <div className="settings__key-form">
                        <input
                          type={showKeys[provider.id] ? 'text' : 'password'}
                          className="settings__key-input"
                          placeholder={`Enter ${provider.name} API key…`}
                          value={editValue}
                          onChange={(e) =>
                            setEditingKeys((prev) => ({
                              ...prev,
                              [provider.id]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSave(provider.id);
                          }}
                        />
                        <button
                          className="settings__key-toggle"
                          onClick={() =>
                            setShowKeys((prev) => ({
                              ...prev,
                              [provider.id]: !prev[provider.id],
                            }))
                          }
                          title={showKeys[provider.id] ? 'Hide' : 'Show'}
                        >
                          {showKeys[provider.id] ? '🙈' : '👁'}
                        </button>
                        <button
                          className="settings__key-save"
                          onClick={() => handleSave(provider.id)}
                          disabled={!editValue.trim()}
                        >
                          Save
                        </button>
                        {hasExistingKey && (
                          <button
                            className="settings__key-cancel"
                            onClick={() =>
                              setEditingKeys((prev) => {
                                const next = { ...prev };
                                delete next[provider.id];
                                return next;
                              })
                            }
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="settings__key-actions">
                        <span className="settings__key-value">
                          {apiKeys[provider.id].slice(0, 8)}…••••
                        </span>
                        <button
                          className="settings__key-edit"
                          onClick={() =>
                            setEditingKeys((prev) => ({
                              ...prev,
                              [provider.id]: '',
                            }))
                          }
                        >
                          Edit
                        </button>
                        <button
                          className="settings__key-remove"
                          onClick={() => handleRemove(provider.id)}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Connected Services */}
      <div className="settings__section">
        <div className="settings__section-header">
          <h2 className="settings__section-title">Connected Services</h2>
          <button
            className="settings__btn settings__btn--small"
            onClick={handleRefreshEndpoints}
          >
            ↻ Refresh
          </button>
        </div>
        <div className="settings__services-grid">
          {Object.entries(endpointStatuses).map(([id, status]) => (
            <div
              key={id}
              className={`settings__service-card settings__service-card--${status.status}`}
              onClick={() => handleOpenUrl(status.url)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleOpenUrl(status.url);
              }}
            >
              <div className="settings__service-card-left">
                <span className="settings__service-card-icon">
                  {status.icon}
                </span>
                <div className="settings__service-card-info">
                  <span className="settings__service-card-name">
                    {status.name}
                  </span>
                  {status.latency !== undefined &&
                    status.status !== 'checking' && (
                      <span className="settings__service-card-latency">
                        {status.latency}ms
                      </span>
                    )}
                </div>
              </div>
              <span
                className={`settings__service-card-status settings__service-card-status--${status.status}`}
              >
                <span
                  className={`settings__service-dot settings__service-dot--${status.status}`}
                />
                {status.status === 'checking'
                  ? 'Checking…'
                  : status.status === 'online'
                  ? 'Online'
                  : status.status === 'offline'
                  ? 'Offline'
                  : 'Unknown'}
              </span>
            </div>
          ))}
        </div>
        {lastChecked && (
          <p className="settings__services-last-checked">
            Last checked: {new Date(lastChecked).toLocaleTimeString()}
          </p>
        )}
      </div>

      {/* Service Credentials */}
      <div className="settings__section">
        <h2 className="settings__section-title">Service Credentials</h2>
        <div className="settings__credentials-note">
          <p>
            OmniClaw cloud services use GCP authentication and require no
            additional credentials from the desktop app. All endpoints are
            accessed directly via HTTPS.
          </p>
          <p className="settings__credentials-sub">
            API keys above are for LLM providers (OpenAI, Anthropic, etc.) only.
          </p>
        </div>
      </div>

      {/* About */}
      <div className="settings__section">
        <h2 className="settings__section-title">About</h2>
        <div className="settings__about">
          <div className="settings__about-row">
            <span className="settings__about-label">App</span>
            <span className="settings__about-value">OmniClaw Desktop</span>
          </div>
          <div className="settings__about-row">
            <span className="settings__about-label">Version</span>
            <span className="settings__about-value">
              {appVersion || '—'}
            </span>
          </div>
          <div className="settings__about-row">
            <span className="settings__about-label">Data Location</span>
            <span className="settings__about-value settings__about-path">
              {dataPath || '—'}
              {dataPath && dataPath !== 'unknown' && (
                <button
                  className="settings__about-open"
                  onClick={handleOpenDataFolder}
                >
                  Open
                </button>
              )}
            </span>
          </div>
          <div className="settings__about-row">
            <span className="settings__about-label">Services</span>
            <span className="settings__about-value">
              {Object.keys(endpointStatuses).length} endpoints
            </span>
          </div>
          <div className="settings__about-row">
            <span className="settings__about-label">Credits</span>
            <span className="settings__about-value">
              Built with ♥ by Subho · Forked from{' '}
              <a
                href="https://github.com/UdaraJay/Pile"
                target="_blank"
                rel="noopener noreferrer"
              >
                Pile
              </a>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}