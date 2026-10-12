import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import StatusBadge from './StatusBadge';
import { Clock, Zap, Hash, Trash2 } from 'lucide-react';

const RunCard = ({ run, onDelete, deleting = false }) => {
  const navigate = useNavigate();

  const timeAgo = (date) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01, borderColor: 'var(--border-light)' }}
      onClick={() => navigate(`/runs/${run._id}`)}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '16px 20px',
        cursor: 'pointer',
        transition: 'border-color 0.2s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: 'var(--accent-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Zap size={16} color="var(--accent)" />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {run.workflowId?.name || 'Unknown Workflow'}
          </div>
          <div style={{
            fontSize: '12px',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '2px',
          }}>
            <Hash size={10} />
            {run._id.slice(-8)}
            <span>•</span>
            <Clock size={10} />
            {timeAgo(run.createdAt)}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {run.stepCount || 0} steps
        </span>
        <StatusBadge status={run.status} />
        {run.status === 'failed' && onDelete && (
          <button
            type="button"
            aria-label={`Delete failed run ${run._id.slice(-8)}`}
            title="Delete failed run"
            disabled={deleting}
            onClick={(event) => {
              event.stopPropagation();
              onDelete(run);
            }}
            style={{ display: 'flex', alignItems: 'center', padding: 7, borderRadius: 6, background: 'var(--danger-light)', color: 'var(--danger)' }}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </motion.div>
  );
};

export default RunCard;