import { useOmniClaw, AVAILABLE_PROVIDERS } from '../../context/OmniClawContext';
import './ModelSelector.scss';

export default function ModelSelector() {
  const { selectedProviders, toggleProvider, apiKeys } = useOmniClaw();

  return (
    <div className="model-selector">
      {AVAILABLE_PROVIDERS.map((provider) => {
        const isSelected = selectedProviders.includes(provider.id);
        const hasKey = provider.id === 'ollama' || !!apiKeys[provider.id];

        return (
          <button
            key={provider.id}
            className={`model-selector__chip ${
              isSelected ? 'model-selector__chip--selected' : ''
            } ${!hasKey ? 'model-selector__chip--no-key' : ''}`}
            onClick={() => toggleProvider(provider.id)}
            style={
              isSelected
                ? { borderColor: provider.color, boxShadow: `0 0 0 1px ${provider.color}` }
                : undefined
            }
          >
            <span
              className="model-selector__dot"
              style={{ backgroundColor: provider.color }}
            />
            <span className="model-selector__name">{provider.name}</span>
            {!hasKey && <span className="model-selector__warning">⚠</span>}
          </button>
        );
      })}
    </div>
  );
}