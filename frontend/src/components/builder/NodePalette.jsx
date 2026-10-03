import { NODE_TYPES, PALETTE_ITEMS } from './nodeConfig';

const NodePalette = () => {
  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div style={{
      width: 220,
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border)',
      padding: '16px 12px',
      flexShrink: 0,
      overflowY: 'auto',
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12, padding: '0 4px' }}>
        Nodes
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {PALETTE_ITEMS.map((type) => {
          const config = NODE_TYPES[type];
          const Icon = config.icon;
          return (
            <div
              key={type}
              draggable
              onDragStart={(e) => onDragStart(e, type)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 8,
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                cursor: 'grab',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = config.color}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <div style={{
                width: 26,
                height: 26,
                borderRadius: 6,
                background: config.bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Icon size={13} color={config.color} />
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)' }}>
                {config.label}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 20, padding: '10px 12px', background: 'var(--bg-card)', borderRadius: 8, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Drag a node onto the canvas, then connect nodes by dragging from one handle to another.
      </div>
    </div>
  );
};

export default NodePalette;