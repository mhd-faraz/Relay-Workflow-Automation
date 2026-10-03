const STATUS_CONFIG = {
  pending:   { color: 'var(--warning)',  bg: 'var(--warning-light)',  label: 'Pending'   },
  running:   { color: 'var(--info)',     bg: 'var(--info-light)',     label: 'Running'   },
  paused:    { color: 'var(--warning)',  bg: 'var(--warning-light)',  label: 'Paused'    },
  completed: { color: 'var(--success)',  bg: 'var(--success-light)',  label: 'Completed' },
  failed:    { color: 'var(--danger)',   bg: 'var(--danger-light)',   label: 'Failed'    },
  cancelled: { color: 'var(--text-muted)', bg: 'var(--bg-hover)',    label: 'Cancelled' },
  draft:     { color: 'var(--text-secondary)', bg: 'var(--bg-hover)', label: 'Draft'    },
  published: { color: 'var(--success)',  bg: 'var(--success-light)',  label: 'Published' },
  approved:  { color: 'var(--success)',  bg: 'var(--success-light)',  label: 'Approved'  },
  rejected:  { color: 'var(--danger)',   bg: 'var(--danger-light)',   label: 'Rejected'  },
};

const StatusBadge = ({ status, size = 'sm' }) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const fontSize = size === 'sm' ? '11px' : '13px';
  const padding = size === 'sm' ? '3px 8px' : '5px 12px';

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      padding,
      borderRadius: '20px',
      fontSize,
      fontWeight: 600,
      color: config.color,
      background: config.bg,
      border: `1px solid ${config.color}30`,
      letterSpacing: '0.3px',
      textTransform: 'uppercase',
    }}>
      <span style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: config.color,
        display: 'inline-block',
        animation: status === 'running' ? 'pulse 1.5s ease-in-out infinite' : 'none',
      }} />
      {config.label}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
      `}</style>
    </span>
  );
};

export default StatusBadge;