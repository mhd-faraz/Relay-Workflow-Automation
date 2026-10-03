import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getApprovals, resolveApproval } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import Loader from '../components/Loader';
import { CheckCircle, XCircle, Clock, User } from 'lucide-react';

const Approvals = () => {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(null);
  const [filter, setFilter] = useState('pending');
  const [message, setMessage] = useState(null);

  const fetchApprovals = async () => {
    try {
      const res = await getApprovals(filter);
      setApprovals(res.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchApprovals(); }, [filter]);

  const handleResolve = async (id, action) => {
    setResolving(`${id}-${action}`);
    try {
      await resolveApproval(id, action, 'admin', `${action} via console`);
      setMessage({ type: action === 'approved' ? 'success' : 'error', text: `Request ${action}!` });
      fetchApprovals();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed' });
    }
    setResolving(null);
    setTimeout(() => setMessage(null), 3000);
  };

  return (
    <div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '4px' }}>Approvals</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
          Human-in-the-loop approval gates
        </p>
      </motion.div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: 'var(--bg-card)', padding: '4px', borderRadius: 'var(--radius-sm)', width: 'fit-content', border: '1px solid var(--border)' }}>
        {['pending', 'approved', 'rejected'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '7px 16px',
              borderRadius: 6,
              fontSize: '13px',
              fontWeight: filter === f ? 600 : 400,
              background: filter === f ? 'var(--accent)' : 'transparent',
              color: filter === f ? 'white' : 'var(--text-secondary)',
              transition: 'all 0.15s',
              textTransform: 'capitalize',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Message */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '16px',
              fontSize: '14px',
              background: message.type === 'success' ? 'var(--success-light)' : 'var(--danger-light)',
              color: message.type === 'success' ? 'var(--success)' : 'var(--danger)',
            }}
          >
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? <Loader /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {approvals.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '48px',
              color: 'var(--text-muted)',
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              fontSize: '14px',
            }}>
              <Clock size={32} style={{ marginBottom: '12px', opacity: 0.4 }} />
              <div>No {filter} approvals</div>
            </div>
          ) : approvals.map((approval, i) => (
            <motion.div
              key={approval._id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '20px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '16px', fontWeight: 600 }}>{approval.nodeName}</span>
                    <StatusBadge status={approval.status} />
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <User size={12} />
                    Run: <code style={{ fontSize: '12px', background: 'var(--bg-hover)', padding: '1px 6px', borderRadius: 4 }}>{String(approval.runId).slice(-8)}</code>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Requested: {new Date(approval.requestedAt).toLocaleString()}
                  </div>
                  {approval.comment && (
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px', padding: '8px 12px', background: 'var(--bg-hover)', borderRadius: 6 }}>
                      {approval.comment}
                    </div>
                  )}
                </div>

                {approval.status === 'pending' && (
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button
                      onClick={() => handleResolve(approval._id, 'approved')}
                      disabled={!!resolving}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 16px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--success-light)',
                        color: 'var(--success)',
                        fontSize: '13px',
                        fontWeight: 600,
                        border: '1px solid var(--success)30',
                        transition: 'all 0.15s',
                      }}
                    >
                      <CheckCircle size={14} /> Approve
                    </button>
                    <button
                      onClick={() => handleResolve(approval._id, 'rejected')}
                      disabled={!!resolving}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 16px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--danger-light)',
                        color: 'var(--danger)',
                        fontSize: '13px',
                        fontWeight: 600,
                        border: '1px solid var(--danger)30',
                        transition: 'all 0.15s',
                      }}
                    >
                      <XCircle size={14} /> Reject
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Approvals;