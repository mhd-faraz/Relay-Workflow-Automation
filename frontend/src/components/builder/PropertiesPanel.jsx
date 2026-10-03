import { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import { NODE_TYPES } from './nodeConfig';

const PropertiesPanel = ({ node, onUpdate, onClose, onDelete }) => {
  const [label, setLabel] = useState('');
  const [config, setConfig] = useState({});
  const [jsonErrors, setJsonErrors] = useState({});

  useEffect(() => {
    if (node) {
      setLabel(node.data.label || '');
      setConfig(node.data.config || {});
      setJsonErrors({});
    }
  }, [node]);

  if (!node) return null;
  const nodeType = NODE_TYPES[node.data.nodeType];
  if (!nodeType) return null;

  const handleFieldChange = (key, value, type) => {
    if (type === 'json') {
      try {
        const parsed = value.trim() === '' ? {} : JSON.parse(value);
        setConfig((prev) => ({ ...prev, [key]: parsed }));
        setJsonErrors((prev) => ({ ...prev, [key]: null }));
      } catch {
        setJsonErrors((prev) => ({ ...prev, [key]: 'Invalid JSON' }));
      }
      setConfig((prev) => ({ ...prev, [`__raw_${key}`]: value }));
    } else if (type === 'number') {
      setConfig((prev) => ({ ...prev, [key]: Number(value) }));
    } else {
      setConfig((prev) => ({ ...prev, [key]: value }));
    }
  };

  const handleSave = () => {
    const cleanConfig = { ...config };
    Object.keys(cleanConfig).forEach((k) => {
      if (k.startsWith('__raw_')) delete cleanConfig[k];
    });
    onUpdate(node.id, { label, config: cleanConfig });
  };

  const getFieldValue = (field) => {
    if (field.type === 'json') {
      if (config[`__raw_${field.key}`] !== undefined) return config[`__raw_${field.key}`];
      return config[field.key] ? JSON.stringify(config[field.key], null, 2) : '';
    }
    return config[field.key] ?? '';
  };

  return (
    <div style={{
      width: 300,
      background: 'var(--bg-secondary)',
      borderLeft: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    }}>
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{nodeType.label}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{nodeType.description}</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', color: 'var(--text-muted)', padding: 4 }}>
          <X size={16} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
            Node Name
          </label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={nodeType.label}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontSize: 13,
            }}
          />
        </div>

        {nodeType.fields.map((field) => (
          <div key={field.key}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
              {field.label}
            </label>

            {field.type === 'textarea' || field.type === 'json' ? (
              <textarea
                value={getFieldValue(field)}
                onChange={(e) => handleFieldChange(field.key, e.target.value, field.type)}
                placeholder={field.placeholder}
                rows={field.type === 'json' ? 5 : 4}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: `1px solid ${jsonErrors[field.key] ? 'var(--danger)' : 'var(--border)'}`,
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  fontFamily: field.type === 'json' ? 'monospace' : 'inherit',
                  resize: 'vertical',
                }}
              />
            ) : field.type === 'select' ? (
              <select
                value={config[field.key] ?? field.options[0]}
                onChange={(e) => handleFieldChange(field.key, e.target.value, field.type)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                }}
              >
                {field.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            ) : (
              <input
                type={field.type === 'number' ? 'number' : 'text'}
                value={getFieldValue(field)}
                onChange={(e) => handleFieldChange(field.key, e.target.value, field.type)}
                placeholder={field.placeholder}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                }}
              />
            )}
            {jsonErrors[field.key] && (
              <div style={{ fontSize: 10, color: 'var(--danger)', marginTop: 4 }}>{jsonErrors[field.key]}</div>
            )}
          </div>
        ))}
      </div>

      <div style={{ padding: 16, borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
        <button
          onClick={handleSave}
          style={{
            flex: 1,
            padding: '9px',
            borderRadius: 6,
            background: 'var(--accent)',
            color: 'white',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Apply
        </button>
        <button
          onClick={() => onDelete(node.id)}
          style={{
            padding: '9px 12px',
            borderRadius: 6,
            background: 'var(--danger-light)',
            color: 'var(--danger)',
          }}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};

export default PropertiesPanel;