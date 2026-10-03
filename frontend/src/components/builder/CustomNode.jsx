import { Handle, Position } from 'reactflow';
import { NODE_TYPES } from './nodeConfig';

const CustomNode = ({ data, selected }) => {
  const config = NODE_TYPES[data.nodeType] || NODE_TYPES.notify;
  const Icon = config.icon;

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: `1.5px solid ${selected ? config.color : 'var(--border)'}`,
        borderRadius: 10,
        padding: '10px 14px',
        minWidth: 180,
        boxShadow: selected ? `0 0 0 3px ${config.bg}` : 'none',
        transition: 'all 0.15s',
      }}
    >
      {data.nodeType !== 'trigger' && (
        <Handle type="target" position={Position.Top} style={{ background: config.color, width: 8, height: 8, border: 'none' }} />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 28,
          height: 28,
          borderRadius: 7,
          background: config.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={14} color={config.color} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {data.label || config.label}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{config.label}</div>
        </div>
      </div>

      {data.nodeType === 'condition' ? (
        <>
          <Handle type="source" position={Position.Bottom} id="true" style={{ left: '30%', background: '#22c55e', width: 8, height: 8, border: 'none' }} />
          <Handle type="source" position={Position.Bottom} id="false" style={{ left: '70%', background: '#ef4444', width: 8, height: 8, border: 'none' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 9, color: 'var(--text-muted)' }}>
            <span style={{ marginLeft: '18%' }}>true</span>
            <span style={{ marginRight: '18%' }}>false</span>
          </div>
        </>
      ) : (
        <Handle type="source" position={Position.Bottom} style={{ background: config.color, width: 8, height: 8, border: 'none' }} />
      )}
    </div>
  );
};

export default CustomNode;