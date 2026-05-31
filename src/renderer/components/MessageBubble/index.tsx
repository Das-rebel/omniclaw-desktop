import { useEffect, useRef, useState } from 'react';
import { AVAILABLE_PROVIDERS } from '../../context/OmniClawContext';
import './MessageBubble.scss';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  provider?: string;
  model?: string;
  status: 'sending' | 'streaming' | 'done' | 'error';
  error?: string;
  timestamp: number;
}

interface MessageBubbleProps {
  message: Message;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isCouncil = message.provider === 'council';
  const [isSpeaking, setIsSpeaking] = useState(false);
  const provider = isCouncil
    ? { name: 'OmniClaw Council', color: '#f59e0b' }
    : AVAILABLE_PROVIDERS.find((p) => p.id === message.provider);

  const handleSpeak = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(message.content);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  // Auto-scroll hook placeholder
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      className={`message-bubble ${
        isUser ? 'message-bubble--user' : 'message-bubble--assistant'
      }`}
    >
      {!isUser && provider && (
        <div className="message-bubble__provider-bar">
          <span
            className="message-bubble__provider-dot"
            style={{ backgroundColor: provider.color }}
          />
          <span className="message-bubble__provider-name">{provider.name}</span>
          {message.model && (
            <span className="message-bubble__provider-model">{message.model}</span>
          )}
        </div>
      )}
      <div className="message-bubble__content">
        {message.status === 'sending' && (
          <span className="message-bubble__dots">
            <span className="message-bubble__dot">●</span>
            <span className="message-bubble__dot">●</span>
            <span className="message-bubble__dot">●</span>
          </span>
        )}
        {message.status === 'streaming' && (
          <>
            <span className="message-bubble__text">{message.content}</span>
            <span className="message-bubble__cursor">▍</span>
          </>
        )}
        {message.status === 'done' && (
          <>
            <span className="message-bubble__text">{message.content}</span>
            {!isUser && message.content.length > 100 && (
              <button
                className={`message-bubble__speak ${isSpeaking ? 'message-bubble__speak--active' : ''}`}
                onClick={handleSpeak}
                title={isSpeaking ? 'Stop' : 'Read aloud'}
              >
                {isSpeaking ? '⏹' : '🔊'}
              </button>
            )}
          </>
        )}
        {message.status === 'error' && (
          <div className="message-bubble__error">
            <span className="message-bubble__error-icon">⚠</span>
            <span>{message.error || 'Unknown error'}</span>
          </div>
        )}
      </div>
    </div>
  );
}