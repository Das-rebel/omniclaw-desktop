import { NavLink } from 'react-router-dom';
import { useOmniClaw } from '../../context/OmniClawContext';
import './Sidebar.scss';

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
}

export default function Sidebar({ open, onToggle }: SidebarProps) {
  const { conversations, currentConversation, loadConversation, createConversation, deleteConversation } =
    useOmniClaw();

  return (
    <div className={`sidebar ${open ? 'sidebar--open' : 'sidebar--collapsed'}`}>
      <div className="sidebar__header">
        <div className="sidebar__logo" onClick={onToggle}>
          <span className="sidebar__logo-icon">◇</span>
          {open && <span className="sidebar__logo-text">OmniClaw</span>}
        </div>
      </div>

      <button className="sidebar__new-chat" onClick={createConversation}>
        <span className="sidebar__new-chat-icon">+</span>
        {open && <span className="sidebar__new-chat-label">New Chat</span>}
      </button>

      <nav className="sidebar__nav">
        <NavLink
          to="/"
          className={({ isActive }) =>
            `sidebar__nav-item ${isActive ? 'sidebar__nav-item--active' : ''}`
          }
          end
        >
          <span className="sidebar__nav-icon">💬</span>
          {open && <span className="sidebar__nav-label">Chat</span>}
        </NavLink>
        <NavLink
          to="/services"
          className={({ isActive }) =>
            `sidebar__nav-item ${isActive ? 'sidebar__nav-item--active' : ''}`
          }
        >
          <span className="sidebar__nav-icon">🔌</span>
          {open && <span className="sidebar__nav-label">Services</span>}
        </NavLink>
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `sidebar__nav-item ${isActive ? 'sidebar__nav-item--active' : ''}`
          }
        >
          <span className="sidebar__nav-icon">📊</span>
          {open && <span className="sidebar__nav-label">Dashboard</span>}
        </NavLink>
        <NavLink
          to="/notebook"
          className={({ isActive }) =>
            `sidebar__nav-item ${isActive ? 'sidebar__nav-item--active' : ''}`
          }
        >
          <span className="sidebar__nav-icon">📓</span>
          {open && <span className="sidebar__nav-label">Notebook</span>}
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `sidebar__nav-item ${isActive ? 'sidebar__nav-item--active' : ''}`
          }
        >
          <span className="sidebar__nav-icon">⚙️</span>
          {open && <span className="sidebar__nav-label">Settings</span>}
        </NavLink>
      </nav>

      {open && (
        <div className="sidebar__conversations">
          <div className="sidebar__conversations-header">Recent</div>
          <div className="sidebar__conversations-list">
            {conversations.length === 0 && (
              <div className="sidebar__conversations-empty">No conversations yet</div>
            )}
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`sidebar__conversation ${
                  currentConversation?.id === conv.id
                    ? 'sidebar__conversation--active'
                    : ''
                }`}
                onClick={() => loadConversation(conv.id)}
              >
                <span className="sidebar__conversation-title">{conv.title}</span>
                <button
                  className="sidebar__conversation-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConversation(conv.id);
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}