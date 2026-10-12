import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getRuns, getWorkflows, getApprovals, deleteFailedRun } from '../services/api';
import RunCard from '../components/RunCard';
import Loader from '../components/Loader';
import { Activity, GitBranch, CheckSquare, AlertTriangle } from 'lucide-react';

const StatCard = ({ icon: Icon, label, value, color, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: '20px 24px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      flex: 1,
    }}
  >
    <div style={{
      width: 48,
      height: 48,
      borderRadius: 12,
      background: `${color}20`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}>
      <Icon size={22} color={color} />
    </div>
    <div>
      <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>{label}</div>
    </div>
  </motion.div>
);

const Dashboard = () => {
  const [runs, setRuns] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingRunId, setDeletingRunId] = useState(null);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [runsRes, wfRes, appRes] = await Promise.all([
          getRuns(),
          getWorkflows(),
          getApprovals('pending'),
        ]);
        setRuns(runsRes.data.data || []);
        setWorkflows(wfRes.data.data || []);
        setApprovals(appRes.data.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
    const interval = setInterval(fetchAll, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleDeleteFailedRun = async (run) => {
    if (!window.confirm(`Delete this failed run for "${run.workflowId?.name || 'Unknown Workflow'}"? This cannot be undone.`)) return;
    setDeletingRunId(run._id);
    setActionError('');
    try {
      await deleteFailedRun(run._id);
      setRuns((currentRuns) => currentRuns.filter((currentRun) => currentRun._id !== run._id));
    } catch (err) {
      if (err.response?.status === 404 && err.response?.data?.error === 'Route not found') {
        setActionError('Failed-run deletion is not available on the connected backend yet. Deploy the latest backend, then try again.');
      } else {
        setActionError(err.response?.data?.error || 'Could not delete failed run');
      }
    } finally {
      setDeletingRunId(null);
    }
  };

  if (loading) return <Loader />;

  const completed = runs.filter((r) => r.status === 'completed').length;
  const failedRuns = runs.filter((r) => r.status === 'failed');
  const running = runs.filter((r) => r.status === 'running').length;

  return (
    <div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '4px' }}>Dashboard</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '28px' }}>
          Real-time overview of your workflow engine
        </p>
      </motion.div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '28px', flexWrap: 'wrap' }}>
        <StatCard icon={GitBranch}   label="Total Workflows"   value={workflows.length} color="var(--accent)"  delay={0}    />
        <StatCard icon={Activity}    label="Total Runs"        value={runs.length}      color="var(--info)"    delay={0.05} />
        <StatCard icon={CheckSquare} label="Completed"         value={completed}        color="var(--success)" delay={0.1}  />
        <StatCard icon={AlertTriangle} label="Failed Runs"       value={failedRuns.length} color="var(--danger)" delay={0.15} />
        <StatCard icon={AlertTriangle} label="Pending Approvals" value={approvals.length} color="var(--warning)" delay={0.2}  />
      </div>

      {/* Running now */}
      {running > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            background: 'var(--info-light)',
            border: '1px solid var(--info)',
            borderRadius: 'var(--radius)',
            padding: '12px 16px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '14px',
            color: 'var(--info)',
          }}
        >
          <Activity size={16} />
          <strong>{running} run{running > 1 ? 's' : ''} currently executing...</strong>
        </motion.div>
      )}

      {failedRuns.length > 0 && (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--danger)',
          borderRadius: 'var(--radius)',
          padding: '20px',
          marginBottom: '20px',
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: 'var(--text-primary)' }}>
            Failed Runs ({failedRuns.length})
          </h2>
          {actionError && (
            <div role="alert" style={{ color: 'var(--danger)', background: 'var(--danger-light)', padding: '10px 12px', borderRadius: 6, marginBottom: 12, fontSize: 13 }}>
              {actionError}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {failedRuns.map((run) => (
              <RunCard
                key={run._id}
                run={run}
                onDelete={handleDeleteFailedRun}
                deleting={deletingRunId === run._id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recent Runs */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '20px',
      }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: 'var(--text-primary)' }}>
          Recent Runs
        </h2>
        {runs.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px', fontSize: '14px' }}>
            No runs yet — trigger a workflow to get started!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {runs.slice(0, 10).map((run) => (
              <RunCard key={run._id} run={run} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;