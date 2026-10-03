import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getRuns, getWorkflows, getApprovals } from '../services/api';
import StatusBadge from '../components/StatusBadge';
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

  if (loading) return <Loader />;

  const completed = runs.filter((r) => r.status === 'completed').length;
  const failed = runs.filter((r) => r.status === 'failed').length;
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
        <StatCard icon={AlertTriangle} label="Pending Approvals" value={approvals.length} color="var(--warning)" delay={0.15} />
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