import { useState } from 'react';
import './Notebook.scss';

const PRESET_COLORS = [
  '#4d80e6', // blue (accent)
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
];

interface CreateCollectionModalProps {
  onClose: () => void;
  onSave: (data: { name: string; description: string; color: string }) => void;
  initialData?: { name: string; description: string; color: string };
}

export default function CreateCollectionModal({
  onClose,
  onSave,
  initialData,
}: CreateCollectionModalProps) {
  const [name, setName] = useState(initialData?.name ?? '');
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [color, setColor] = useState(initialData?.color ?? PRESET_COLORS[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), description: description.trim(), color });
  };

  return (
    <div className="notebook__modal-overlay" onClick={onClose}>
      <div
        className="notebook__modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="notebook__modal-header">
          <h3 className="notebook__modal-title">
            {initialData ? 'Edit Collection' : 'New Collection'}
          </h3>
          <button
            className="notebook__modal-close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <form className="notebook__modal-body" onSubmit={handleSubmit}>
          <div className="notebook__field">
            <label className="notebook__field-label">Name</label>
            <input
              className="notebook__field-input"
              type="text"
              placeholder="Collection name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="notebook__field">
            <label className="notebook__field-label">
              Description{' '}
              <span className="notebook__field-optional">(optional)</span>
            </label>
            <textarea
              className="notebook__field-textarea"
              placeholder="What's this collection about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="notebook__field">
            <label className="notebook__field-label">Color</label>
            <div className="notebook__color-picker">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`notebook__color-swatch ${color === c ? 'notebook__color-swatch--active' : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                >
                  {color === c && '✓'}
                </button>
              ))}
            </div>
          </div>
          <div className="notebook__modal-actions">
            <button
              type="button"
              className="notebook__btn notebook__btn--secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="notebook__btn notebook__btn--primary"
              disabled={!name.trim()}
            >
              {initialData ? 'Save Changes' : 'Create Collection'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}