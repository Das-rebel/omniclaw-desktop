import { useState, useEffect } from 'react';
import './Notebook.scss';

export interface NoteData {
  id: string;
  title: string;
  content: string;
  tags: string[];
  collectionIds: string[];
  createdAt: number;
  updatedAt: number;
}

interface CollectionOption {
  id: string;
  name: string;
  color: string;
}

interface NoteEditorProps {
  note: NoteData | null;
  collections: CollectionOption[];
  onSave: (data: {
    title: string;
    content: string;
    tags: string[];
    collectionIds: string[];
  }) => void;
  onDelete?: () => void;
  onCancel: () => void;
}

export default function NoteEditor({
  note,
  collections,
  onSave,
  onDelete,
  onCancel,
}: NoteEditorProps) {
  const [title, setTitle] = useState(note?.title ?? '');
  const [content, setContent] = useState(note?.content ?? '');
  const [tagsInput, setTagsInput] = useState(note?.tags?.join(', ') ?? '');
  const [selectedCollections, setSelectedCollections] = useState<string[]>(
    note?.collectionIds ?? []
  );
  const [lastSaved, setLastSaved] = useState<number | null>(null);

  useEffect(() => {
    setTitle(note?.title ?? '');
    setContent(note?.content ?? '');
    setTagsInput(note?.tags?.join(', ') ?? '');
    setSelectedCollections(note?.collectionIds ?? []);
  }, [note]);

  // Auto-save after 2s of inactivity
  useEffect(() => {
    if (!title.trim()) return;
    const timer = setTimeout(() => {
      const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
      onSave({ title: title.trim(), content, tags, collectionIds: selectedCollections });
      setLastSaved(Date.now());
    }, 2000);
    return () => clearTimeout(timer);
  }, [title, content, tagsInput, selectedCollections]);

  const toggleCollection = (id: string) => {
    setSelectedCollections((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    onSave({
      title: title.trim(),
      content,
      tags,
      collectionIds: selectedCollections,
    });
  };

  return (
    <div className="notebook__editor">
      <div className="notebook__editor-header">
        <h3 className="notebook__editor-title">
          {note ? 'Edit Note' : 'New Note'}
        </h3>
        {lastSaved && (
          <span className="notebook__editor-saved">
            ✓ Saved {new Date(lastSaved).toLocaleTimeString()}
          </span>
        )}
        <div className="notebook__editor-actions">
          <button
            type="button"
            className="notebook__btn notebook__btn--secondary"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="notebook__btn notebook__btn--primary"
            onClick={handleSubmit}
            disabled={!title.trim()}
            form="notebook-editor-form"
          >
            Save
          </button>
        </div>
      </div>
      <form className="notebook__editor-body" onSubmit={handleSubmit} id="notebook-editor-form">
        <div className="notebook__field">
          <label className="notebook__field-label">Title</label>
          <input
            className="notebook__field-input"
            type="text"
            placeholder="Note title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </div>
        <div className="notebook__field">
          <label className="notebook__field-label">Content</label>
          <textarea
            className="notebook__field-textarea notebook__field-textarea--large"
            placeholder="Write your note…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={12}
          />
        </div>
        <div className="notebook__field">
          <label className="notebook__field-label">
            Tags{' '}
            <span className="notebook__field-optional">(comma-separated)</span>
          </label>
          <input
            className="notebook__field-input"
            type="text"
            placeholder="e.g. research, ideas, meeting-notes"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
          />
          {tagsInput && (
            <div className="notebook__tags-preview">
              {tagsInput
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean)
                .map((tag, i) => (
                  <span key={i} className="notebook__tag-chip">
                    {tag}
                  </span>
                ))}
            </div>
          )}
        </div>
        {collections.length > 0 && (
          <div className="notebook__field">
            <label className="notebook__field-label">Add to Collections</label>
            <div className="notebook__collection-check-list">
              {collections.map((col) => (
                <label key={col.id} className="notebook__collection-check">
                  <input
                    type="checkbox"
                    checked={selectedCollections.includes(col.id)}
                    onChange={() => toggleCollection(col.id)}
                  />
                  <span
                    className="notebook__collection-dot"
                    style={{ backgroundColor: col.color }}
                  />
                  <span className="notebook__collection-check-name">
                    {col.name}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
        {note && onDelete && (
          <div className="notebook__editor-danger-zone">
            <button
              type="button"
              className="notebook__btn notebook__btn--danger"
              onClick={onDelete}
            >
              Delete Note
            </button>
          </div>
        )}
      </form>
    </div>
  );
}