import { useState, useEffect } from 'react';
import { getRuns } from '../services/api';
import RunCard from '../components/RunCard';
import Loader from '../components/Loader';
import { motion } from 'framer-motion';

const Runs = () => {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const fetchRuns = async () => {
    try {
      const res = await getRuns(filter ? { status: filter } : {});
      setRuns(res.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRuns(); }, [filter]);
  useEffect(() => {
    const interval = setInterval(fetchRuns, 4000);
    return () => clearInterval(interval);
  }, [filter]);

  return (
    <div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '4px' }}>All Runs</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
          Complete run history with step traces
        </p>
      </motion.div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: 'var(--bg-card)', padding: '4px', borderRadius: 'var(--radius-sm)', width: 'fit-content', border: '1px solid var(--border)' }}>
        {['', 'running', 'completed', 'failed', 'paused'].map((f) => (
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
            {f || 'All'}
          </button>
        ))}
      </div>

      {loading ? <Loader /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {runs.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '48px',
              color: 'var(--text-muted)',
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              fontSize: '14px',
            }}>
              No runs found
            </div>
          ) : runs.map((run) => (
            <RunCard key={run._id} run={run} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Runs;