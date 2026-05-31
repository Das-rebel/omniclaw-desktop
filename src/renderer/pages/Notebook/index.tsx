import { useState, useEffect, useCallback } from 'react';
import { useOmniClaw } from '../../context/OmniClawContext';
import { useToasts } from '../../context/ToastsContext';
import CreateCollectionModal from './CreateCollectionModal';
import NoteEditor from './NoteEditor';
import './Notebook.scss';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface Collection {
  id: string;
  name: string;
  description?: string;
  color: string;
  items: CollectionItem[];
  createdAt: number;
  updatedAt: number;
}

interface CollectionItem {
  type: 'bookmark' | 'note';
  bookmarkId?: string;
  bookmarkUrl?: string;
  bookmarkTitle?: string;
  noteId?: string;
  addedAt: number;
  note?: string;
}

interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  collectionIds?: string[];
  createdAt: number;
  updatedAt: number;
}

interface BookmarkNote {
  bookmarkId: string;
  bookmarkTitle: string;
  bookmarkUrl?: string;
  notes: {
    id: string;
    content: string;
    createdAt: number;
    updatedAt: number;
  }[];
}

type ViewMode = 'all-notes' | 'collection' | 'note-editor';

export default function Notebook() {
  const { bookmarks, fetchBookmarks } = useOmniClaw();
  const { addToast } = useToasts();

  // Data state
  const [collections, setCollections] = useState<Collection[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [bookmarkNotes, setBookmarkNotes] = useState<BookmarkNote[]>([]);

  // UI state
  const [activeView, setActiveView] = useState<ViewMode>('all-notes');
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Load all data from IPC
  const loadData = useCallback(async () => {
    try {
      const [cols, ns, bns] = await Promise.all([
        window.electron.collections.list() as Promise<Collection[]>,
        window.electron.notes.list() as Promise<Note[]>,
        window.electron.bookmarkNotes.list() as Promise<BookmarkNote[]>,
      ]);
      setCollections(cols || []);
      setNotes(ns || []);
      setBookmarkNotes(bns || []);
    } catch (err) {
      console.error('Failed to load notebook data:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Also fetch bookmarks if not already loaded
  useEffect(() => {
    if (bookmarks.length === 0) {
      fetchBookmarks();
    }
  }, []);

  // ── Collections CRUD ──

  const saveCollection = useCallback(
    async (data: { name: string; description: string; color: string }) => {
      const id =
        editingCollection?.id ?? `col_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const now = Date.now();
      const collection: Collection = {
        id,
        name: data.name,
        description: data.description,
        color: data.color,
        items: editingCollection?.items ?? [],
        createdAt: editingCollection?.createdAt ?? now,
        updatedAt: now,
      };
      await window.electron.collections.save(id, collection);
      await loadData();
      setShowCreateCollection(false);
      setEditingCollection(null);
      addToast(
        editingCollection ? 'Collection updated' : 'Collection created',
        'success'
      );
    },
    [editingCollection, loadData, addToast]
  );

  const deleteCollection = useCallback(
    async (id: string) => {
      await window.electron.collections.delete(id);
      if (activeCollectionId === id) {
        setActiveView('all-notes');
        setActiveCollectionId(null);
      }
      await loadData();
      addToast('Collection deleted', 'info');
    },
    [activeCollectionId, loadData, addToast]
  );

  // ── Notes CRUD ──

  const saveNote = useCallback(
    async (data: {
      title: string;
      content: string;
      tags: string[];
      collectionIds: string[];
    }) => {
      const id =
        editingNote?.id ?? `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const now = Date.now();
      const note: Note = {
        id,
        title: data.title,
        content: data.content,
        tags: data.tags,
        collectionIds: data.collectionIds,
        createdAt: editingNote?.createdAt ?? now,
        updatedAt: now,
      };
      await window.electron.notes.save(id, note);

      // Update collection items for new collections added
      if (data.collectionIds) {
        for (const colId of data.collectionIds) {
          const col = collections.find((c) => c.id === colId);
          if (col) {
            const existingItem = col.items.find(
              (item) => item.type === 'note' && item.noteId === id
            );
            if (!existingItem) {
              col.items.push({
                type: 'note',
                noteId: id,
                addedAt: now,
              });
              await window.electron.collections.save(colId, col);
            }
          }
        }
        // Remove note from collections it no longer belongs to
        for (const col of collections) {
          if (!data.collectionIds.includes(col.id)) {
            const idx = col.items.findIndex(
              (item) => item.type === 'note' && item.noteId === id
            );
            if (idx >= 0) {
              col.items.splice(idx, 1);
              await window.electron.collections.save(col.id, col);
            }
          }
        }
      }

      await loadData();
      setActiveView('all-notes');
      setEditingNote(null);
      addToast(editingNote ? 'Note updated' : 'Note created', 'success');
    },
    [editingNote, collections, loadData, addToast]
  );

  const deleteNote = useCallback(
    async (noteId: string) => {
      await window.electron.notes.delete(noteId);
      // Remove from all collections
      for (const col of collections) {
        const idx = col.items.findIndex(
          (item) => item.type === 'note' && item.noteId === noteId
        );
        if (idx >= 0) {
          col.items.splice(idx, 1);
          await window.electron.collections.save(col.id, col);
        }
      }
      await loadData();
      setActiveView('all-notes');
      setEditingNote(null);
      addToast('Note deleted', 'info');
    },
    [collections, loadData, addToast]
  );

  // ── Add bookmark to collection ──

  const addBookmarkToCollection = useCallback(
    async (collectionId: string, bookmark: any) => {
      const col = collections.find((c) => c.id === collectionId);
      if (!col) return;
      const existing = col.items.find(
        (item) =>
          item.type === 'bookmark' &&
          item.bookmarkUrl === (bookmark.url || bookmark.link)
      );
      if (existing) {
        addToast('Bookmark already in this collection', 'info');
        return;
      }
      col.items.push({
        type: 'bookmark',
        bookmarkId: String(bookmark.id ?? ''),
        bookmarkUrl: bookmark.url || bookmark.link || '',
        bookmarkTitle: bookmark.title || bookmark.name || 'Untitled',
        addedAt: Date.now(),
      });
      await window.electron.collections.save(collectionId, col);
      await loadData();
      addToast('Bookmark added to collection', 'success');
    },
    [collections, loadData, addToast]
  );

  // ── Remove item from collection ──

  const removeItemFromCollection = useCallback(
    async (collectionId: string, itemIndex: number) => {
      const col = collections.find((c) => c.id === collectionId);
      if (!col) return;
      col.items.splice(itemIndex, 1);
      await window.electron.collections.save(collectionId, col);
      await loadData();
      addToast('Item removed from collection', 'info');
    },
    [collections, loadData, addToast]
  );

  // ── Computed ──

  const activeCollection = collections.find(
    (c) => c.id === activeCollectionId
  );

  const filteredNotes = notes.filter((n) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      n.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  // Get bookmark notes count for a given URL
  const getBookmarkNotesCount = useCallback(
    (url: string) => {
      const bn = bookmarkNotes.find((b) => b.bookmarkUrl === url);
      return bn ? bn.notes.length : 0;
    },
    [bookmarkNotes]
  );

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  // ── Render helpers ──

  const renderCollectionItems = (col: Collection) => {
    if (!col.items || col.items.length === 0) {
      return (
        <div className="notebook__empty">
          <span className="notebook__empty-icon">📁</span>
          <div className="notebook__empty-text">
            This collection is empty
          </div>
          <div className="notebook__empty-sub">
            Add notes or bookmarks to get started
          </div>
        </div>
      );
    }

    return (
      <div className="notebook__card-grid">
        {col.items.map((item, idx) => {
          if (item.type === 'bookmark') {
            return (
              <div key={`bm-${idx}`} className="notebook__card notebook__card--bookmark">
                <div className="notebook__card-header">
                  <span className="notebook__card-type-icon">🔖</span>
                  <span className="notebook__card-type-label">Bookmark</span>
                </div>
                <div className="notebook__card-title">
                  {item.bookmarkTitle || 'Untitled Bookmark'}
                </div>
                {item.bookmarkUrl && (
                  <a
                    className="notebook__card-url"
                    href={item.bookmarkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {item.bookmarkUrl && item.bookmarkUrl.length > 40
                      ? item.bookmarkUrl.slice(0, 40) + '…'
                      : item.bookmarkUrl}
                  </a>
                )}
                {item.note && (
                  <div className="notebook__card-note-annotation">
                    📝 {item.note.slice(0, 80)}
                    {item.note.length > 80 ? '…' : ''}
                  </div>
                )}
                <div className="notebook__card-actions">
                  <button
                    className="notebook__card-action-btn"
                    onClick={() => removeItemFromCollection(col.id, idx)}
                    title="Remove from collection"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          }

          // Note item
          const noteData = notes.find((n) => n.id === item.noteId);
          if (!noteData) return null;
          return (
            <div key={`note-${idx}`} className="notebook__card notebook__card--note">
              <div className="notebook__card-header">
                <span className="notebook__card-type-icon">📝</span>
                <span className="notebook__card-type-label">Note</span>
              </div>
              <div className="notebook__card-title">{noteData.title}</div>
              <div className="notebook__card-preview">
                {noteData.content.slice(0, 100)}
                {noteData.content.length > 100 ? '…' : ''}
              </div>
              {noteData.tags.length > 0 && (
                <div className="notebook__card-tags">
                  {noteData.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="notebook__tag-chip">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <div className="notebook__card-meta">
                {formatTime(noteData.updatedAt)}
              </div>
              <div className="notebook__card-actions">
                <button
                  className="notebook__card-action-btn"
                  onClick={() => {
                    setEditingNote(noteData);
                    setActiveView('note-editor');
                  }}
                  title="Edit note"
                >
                  ✏️
                </button>
                <button
                  className="notebook__card-action-btn"
                  onClick={() => removeItemFromCollection(col.id, idx)}
                  title="Remove from collection"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="notebook">
      {/* Sidebar */}
      <div className="notebook__sidebar">
        <div className="notebook__sidebar-header">
          <h2 className="notebook__sidebar-title">📓 Notebook</h2>
        </div>

        <div className="notebook__sidebar-nav">
          <button
            className={`notebook__sidebar-item ${
              activeView === 'all-notes'
                ? 'notebook__sidebar-item--active'
                : ''
            }`}
            onClick={() => {
              setActiveView('all-notes');
              setActiveCollectionId(null);
            }}
          >
            <span className="notebook__sidebar-item-icon">📝</span>
            <span className="notebook__sidebar-item-label">All Notes</span>
            <span className="notebook__sidebar-item-count">{notes.length}</span>
          </button>

          <div className="notebook__sidebar-section-header">Collections</div>
          {collections.map((col) => (
            <div key={col.id} className="notebook__sidebar-collection-row">
              <button
                className={`notebook__sidebar-item ${
                  activeCollectionId === col.id
                    ? 'notebook__sidebar-item--active'
                    : ''
                }`}
                onClick={() => {
                  setActiveView('collection');
                  setActiveCollectionId(col.id);
                }}
              >
                <span
                  className="notebook__sidebar-color-dot"
                  style={{ backgroundColor: col.color }}
                />
                <span className="notebook__sidebar-item-label">
                  {col.name}
                </span>
                <span className="notebook__sidebar-item-count">
                  {(col.items || []).length}
                </span>
              </button>
              <button
                className="notebook__sidebar-collection-edit"
                onClick={() => {
                  setEditingCollection(col);
                  setShowCreateCollection(true);
                }}
                title="Edit collection"
              >
                ✏️
              </button>
            </div>
          ))}
        </div>

        <div className="notebook__sidebar-footer">
          <button
            className="notebook__btn notebook__btn--primary notebook__btn--full"
            onClick={() => {
              setEditingCollection(null);
              setShowCreateCollection(true);
            }}
          >
            + New Collection
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="notebook__main">
        {activeView === 'note-editor' ? (
          <NoteEditor
            note={editingNote}
            collections={collections.map((c) => ({
              id: c.id,
              name: c.name,
              color: c.color,
            }))}
            onSave={saveNote}
            onDelete={
              editingNote
                ? () => deleteNote(editingNote.id)
                : undefined
            }
            onCancel={() => {
              setActiveView(
                activeCollectionId ? 'collection' : 'all-notes'
              );
              setEditingNote(null);
            }}
          />
        ) : activeView === 'all-notes' ? (
          <div className="notebook__content">
            <div className="notebook__content-header">
              <h2 className="notebook__content-title">All Notes</h2>
              <div className="notebook__content-actions">
                <div className="notebook__search-bar">
                  <input
                    className="notebook__search-input"
                    type="text"
                    placeholder="Search notes…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      className="notebook__search-clear"
                      onClick={() => setSearchQuery('')}
                    >
                      ✕
                    </button>
                  )}
                </div>
                <button
                  className="notebook__btn notebook__btn--primary"
                  onClick={() => {
                    setEditingNote(null);
                    setActiveView('note-editor');
                  }}
                >
                  + New Note
                </button>
              </div>
            </div>

            {filteredNotes.length === 0 ? (
              <div className="notebook__empty">
                <span className="notebook__empty-icon">📝</span>
                <div className="notebook__empty-text">
                  {searchQuery
                    ? 'No notes match your search'
                    : 'No notes yet'}
                </div>
                <div className="notebook__empty-sub">
                  {searchQuery
                    ? 'Try a different search term'
                    : 'Create your first note to get started'}
                </div>
                {!searchQuery && (
                  <button
                    className="notebook__btn notebook__btn--primary"
                    onClick={() => {
                      setEditingNote(null);
                      setActiveView('note-editor');
                    }}
                  >
                    Create Note
                  </button>
                )}
              </div>
            ) : (
              <div className="notebook__card-grid">
                {filteredNotes.map((note) => (
                  <div
                    key={note.id}
                    className="notebook__card notebook__card--note"
                    onClick={() => {
                      setEditingNote(note);
                      setActiveView('note-editor');
                    }}
                  >
                    <div className="notebook__card-title">{note.title}</div>
                    <div className="notebook__card-preview">
                      {note.content.slice(0, 100)}
                      {note.content.length > 100 ? '…' : ''}
                    </div>
                    {note.tags.length > 0 && (
                      <div className="notebook__card-tags">
                        {note.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="notebook__tag-chip">
                            {tag}
                          </span>
                        ))}
                        {note.tags.length > 3 && (
                          <span className="notebook__tag-chip notebook__tag-chip--more">
                            +{note.tags.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="notebook__card-meta">
                      {formatTime(note.updatedAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeView === 'collection' && activeCollection ? (
          <div className="notebook__content">
            <div className="notebook__content-header">
              <div className="notebook__content-header-info">
                <div className="notebook__content-title-row">
                  <span
                    className="notebook__collection-color-bar"
                    style={{ backgroundColor: activeCollection.color }}
                  />
                  <h2 className="notebook__content-title">
                    {activeCollection.name}
                  </h2>
                </div>
                {activeCollection.description && (
                  <p className="notebook__content-description">
                    {activeCollection.description}
                  </p>
                )}
              </div>
              <div className="notebook__content-actions">
                <button
                  className="notebook__btn notebook__btn--danger-outline"
                  onClick={() => deleteCollection(activeCollection.id)}
                >
                  Delete
                </button>
                <button
                  className="notebook__btn notebook__btn--primary"
                  onClick={() => {
                    setEditingNote(null);
                    setActiveView('note-editor');
                  }}
                >
                  + Add Note
                </button>
              </div>
            </div>
            {renderCollectionItems(activeCollection)}
          </div>
        ) : null}
      </div>

      {/* Create/Edit Collection Modal */}
      {showCreateCollection && (
        <CreateCollectionModal
          onClose={() => {
            setShowCreateCollection(false);
            setEditingCollection(null);
          }}
          onSave={saveCollection}
          initialData={
            editingCollection
              ? {
                  name: editingCollection.name,
                  description: editingCollection.description || '',
                  color: editingCollection.color,
                }
              : undefined
          }
        />
      )}
    </div>
  );
}