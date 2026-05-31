import { useEffect, useRef, useCallback, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useOmniClaw } from '../../context/OmniClawContext';
import { useToasts } from '../../context/ToastsContext';
import ModelSelector from '../../components/ModelSelector';
import MessageBubble from '../../components/MessageBubble';
import MessageInput from '../../components/MessageInput';
import './Chat.scss';

interface ChatProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export default function Chat({ sidebarOpen, onToggleSidebar }: ChatProps) {
  const {
    currentConversation,
    sendMessage,
    isLoading,
    createConversation,
    selectedProviders,
    searchVault,
    vaultSearchResults,
    vaultSearchLoading,
  } = useOmniClaw();
  const { addToast } = useToasts();
  const navigate = useNavigate();
  const location = useLocation();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [showVaultSearch, setShowVaultSearch] = useState(false);
  const [vaultQuery, setVaultQuery] = useState('');

  // Handle navigation state: "Open in Chat" from Services page, Quick Chat from Dashboard
  useEffect(() => {
    const state = location.state as { vaultQuery?: string } | null;
    if (state?.vaultQuery) {
      setVaultQuery(state.vaultQuery);
      setShowVaultSearch(true);
      searchVault(state.vaultQuery);
      window.history.replaceState({}, '');
    }
    // Handle Quick Chat message from Dashboard
    const quickMsg = sessionStorage.getItem('quickChatMessage');
    if (quickMsg) {
      sessionStorage.removeItem('quickChatMessage');
      const newConv = createConversation();
      // Small delay to let conversation state settle
      setTimeout(() => sendMessage(quickMsg, newConv), 100);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentConversation?.messages?.length]);

  const handleSend = useCallback(
    (content: string) => {
      // Check for @mentions
      const vaultMatch = content.match(/@vault\s+(.+)/i);
      const bookmarksMatch = content.match(/@bookmarks?/i);
      const servicesMatch = content.match(/@services?/i);
      const storyMatch = content.match(/@story\s+(.+)/i);

      if (storyMatch) {
        // Detect genre and persona from prompt
        const prompt = storyMatch[1];
        const genreMatch = prompt.match(/(?:as|like|in style of|genre[:\s]+)(\w+)/i);
        const personaMatch = prompt.match(/(?:narrated by|voice of|as told by)\s+(.+?)(?:\s+about|\s*$)/i);
        
        const genre = genreMatch ? genreMatch[1] : '';
        const persona = personaMatch ? personaMatch[1].trim() : 'a storyteller';
        
        const storyContent = `You are ${persona}, a master storyteller. Generate a short story (about 300-500 words) based on this: "${prompt}".
${genre ? `Genre: ${genre}. ` : ''}
Write with personality matching ${persona}'s voice. Use vivid descriptions.`;
        
        addToast(`🎭 ${persona} is telling a story…`, 'info');
        if (!currentConversation) {
          const newConv = createConversation();
          sendMessage(storyContent, newConv);
        } else {
          sendMessage(storyContent);
        }
        return;
      }

      if (vaultMatch) {
        // Search vault and show the vault panel with results
        const query = vaultMatch[1];
        setVaultQuery(query);
        setShowVaultSearch(true);
        addToast(`Searching vault for: "${query}"`, 'info');
        
        // We now wait for results and augment the prompt so the AI can answer based on them
        searchVault(query).then((results) => {
          if (results.length > 0) {
            addToast(`Found ${results.length} vault results`, 'success');
            
            // Format results as a context block for the AI
            const contextBlock = results.slice(0, 5).map((r, i) => 
              `[Result ${i+1}] ${r.name || 'Untitled'}: ${r.content || r.text || ''}`
            ).join('\\n');
            
            const augmentedContent = `[VAULT SEARCH RESULTS for "${query}"]\\n${contextBlock}\\n\\nUser Question: ${content}`;
            
            if (!currentConversation) {
              const newConv = createConversation();
              sendMessage(augmentedContent, newConv);
            } else {
              sendMessage(augmentedContent);
            }
          } else {
            addToast('No vault results found', 'warning');
            // Still send the original message so the AI can try to answer generally
            if (!currentConversation) {
              const newConv = createConversation();
              sendMessage(content, newConv);
            } else {
              sendMessage(content);
            }
          }
        });
        return;
      }

      if (bookmarksMatch) {
        addToast('Opening Services page for bookmarks…', 'info');
        navigate('/services');
        return;
      }

      if (servicesMatch) {
        navigate('/services');
        return;
      }

      if (!currentConversation) {
        const newConv = createConversation();
        sendMessage(content, newConv);
      } else {
        sendMessage(content);
      }
    },
    [currentConversation, createConversation, sendMessage, searchVault, addToast, navigate]
  );

  const handleEmptySend = useCallback(
    (content: string) => {
      const newConv = createConversation();
      sendMessage(content, newConv);
    },
    [createConversation, sendMessage]
  );

  const handleVaultSearch = async () => {
    if (!vaultQuery.trim()) return;
    await searchVault(vaultQuery.trim());
  };

  // Empty state when no conversation is active
  if (!currentConversation) {
    return (
      <div className="chat chat--empty">
        <button className="chat__sidebar-toggle" onClick={onToggleSidebar}>
          {sidebarOpen ? '←' : '→'}
        </button>
        <div className="chat__empty-content">
          <div className="chat__empty-logo">◇</div>
          <h1 className="chat__empty-title">OmniClaw</h1>
          <p className="chat__empty-subtitle">
            Talk to multiple AI models at once. Select providers and ask anything.
          </p>
          <div className="chat__empty-hints">
            <span className="chat__hint-tag">@vault query</span>
            <span className="chat__hint-tag">@bookmarks</span>
            <span className="chat__hint-tag">@services</span>
          </div>
          <div className="chat__empty-selector">
            <ModelSelector />
          </div>
          <div className="chat__empty-input">
            <MessageInput
              onSend={handleEmptySend}
              placeholder="Ask anything to multiple models…"
            />
          </div>
          <p className="chat__empty-hint">
            {selectedProviders.length === 0
              ? '⚠ Select at least one provider above'
              : `${selectedProviders.length} provider${selectedProviders.length > 1 ? 's' : ''} selected — type your question above`}
          </p>
        </div>
      </div>
    );
  }

  // Active conversation
  return (
    <div className="chat">
      <div className="chat__header">
        <button className="chat__sidebar-toggle" onClick={onToggleSidebar}>
          {sidebarOpen ? '←' : '→'}
        </button>
        <h2 className="chat__header-title">{currentConversation.title}</h2>
        <div className="chat__header-actions">
          <button
            className="chat__header-btn"
            onClick={() => setShowVaultSearch(!showVaultSearch)}
            title="Search Vault"
          >
            🔍
          </button>
          <button
            className="chat__header-btn"
            onClick={() => navigate('/services')}
            title="Services"
          >
            🔌
          </button>
          <div className="chat__header-selector">
            <ModelSelector />
          </div>
        </div>
      </div>

      {showVaultSearch && (
        <div className="chat__vault-panel">
          <div className="chat__vault-bar">
            <input
              type="text"
              className="chat__vault-input"
              placeholder="Search your vault…"
              value={vaultQuery}
              onChange={(e) => setVaultQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleVaultSearch();
              }}
            />
            <button
              className="chat__vault-btn"
              onClick={handleVaultSearch}
              disabled={vaultSearchLoading || !vaultQuery.trim()}
            >
              {vaultSearchLoading ? '…' : 'Search'}
            </button>
            <button
              className="chat__vault-close"
              onClick={() => setShowVaultSearch(false)}
            >
              ✕
            </button>
          </div>
          {vaultSearchResults.length > 0 && (
            <div className="chat__vault-results">
              {vaultSearchResults.slice(0, 5).map((result: any, i: number) => (
                <div key={i} className="chat__vault-result">
                  <div className="chat__vault-result-header">
                    <span className={`chat__vault-type-badge chat__vault-type--${result.type === 'instagram_post' ? 'instagram' : result.type === 'twitter_tweet' ? 'twitter' : 'default'}`}>
                      {result.type === 'instagram_post' ? '📷' : result.type === 'twitter_tweet' ? '🐦' : '🔗'}
                    </span>
                    <div className="chat__vault-result-title">
                      {result.name || result.title || 'Untitled'}
                    </div>
                  </div>
                  <div className="chat__vault-result-snippet">
                    {(result.content || result.text || result.body || '')
                      .slice(0, 100)}
                  </div>
                  {(result.metadata?.tags?.length > 0 || result.hashtags?.length > 0) && (
                    <div className="chat__vault-result-tags">
                      {(result.metadata?.tags || result.hashtags || []).slice(0, 4).map((tag: string, ti: number) => (
                        <span key={ti} className="chat__vault-tag">{tag}</span>
                      ))}
                    </div>
                  )}
                  {result.metadata?.location && (
                    <div className="chat__vault-result-location">📍 {result.metadata.location}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="chat__messages">
        {currentConversation.messages.length === 0 && (
          <div className="chat__messages-empty">
            <div className="chat__messages-empty-icon">◇</div>
            <p>Send a message to start chatting with selected models</p>
            <div className="chat__messages-hints">
              <span className="chat__hint-tag">@vault query</span>
              <span className="chat__hint-tag">@story prompt</span>
              <span className="chat__hint-tag">@bookmarks</span>
              <span className="chat__hint-tag">@services</span>
            </div>
          </div>
        )}
        {currentConversation.messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <MessageInput onSend={sendMessage} disabled={isLoading} />
    </div>
  );
}