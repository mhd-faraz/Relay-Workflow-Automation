import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getRun, getRunSteps } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import Loader from '../components/Loader';
import { ArrowLeft, Clock, Hash, Zap, ChevronDown, ChevronUp } from 'lucide-react';

const StepRow = ({ step, index }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
        marginBottom: '8px',
      }}
    >
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 16px',
          cursor: 'pointer',
          background: 'var(--bg-card)',
          transition: 'background 0.15s',
        }}
      >
        <div style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: 'var(--accent-light)',
          color: 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '11px',
          fontWeight: 700,
          flexShrink: 0,
        }}>
          {index + 1}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: 600 }}>{step.nodeName}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{step.nodeType}</div>
        </div>
        <StatusBadge status={step.status} />
        {step.tokenUsage?.totalTokens > 0 && (
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-hover)', padding: '2px 8px', borderRadius: 4 }}>
            {step.tokenUsage.totalTokens} tokens
          </span>
        )}
        {expanded ? <ChevronUp size={14} color="var(--text-muted)" /> : <ChevronDown size={14} color="var(--text-muted)" />}
      </div>

      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          style={{ background: 'var(--bg-secondary)', padding: '12px 16px', borderTop: '1px solid var(--border)' }}
        >
          {step.output && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Output</div>
              <pre style={{
                fontSize: '12px',
                color: 'var(--text-secondary)',
                background: 'var(--bg-primary)',
                padding: '10px',
                borderRadius: 6,
                overflow: 'auto',
                maxHeight: '200px',
              }}>
                {JSON.stringify(step.output, null, 2)}
              </pre>
            </div>
          )}
          {step.error && (
            <div>
              <div style={{ fontSize: '11px', color: 'var(--danger)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Error</div>
              <div style={{ fontSize: '12px', color: 'var(--danger)', background: 'var(--danger-light)', padding: '8px 12px', borderRadius: 6 }}>
                {step.error}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
};

const RunDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [run, setRun] = useState(null);
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const [runRes, stepsRes] = await Promise.all([getRun(id), getRunSteps(id)]);
        setRun(runRes.data.data);
        setSteps(stepsRes.data.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
    const interval = setInterval(fetch, 3000);
    return () => clearInterval(interval);
  }, [id]);

  if (loading) return <Loader />;
  if (!run) return <div style={{ color: 'var(--danger)' }}>Run not found</div>;

  return (
    <div>
      <button
        onClick={() => navigate(-1)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          color: 'var(--text-secondary)',
          background: 'none',
          fontSize: '14px',
          marginBottom: '20px',
          padding: '4px 0',
        }}
      >
        <ArrowLeft size={16} /> Back
      </button>

      {/* Run Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '20px 24px',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <Zap size={20} color="var(--accent)" />
              <h1 style={{ fontSize: '20px', fontWeight: 700 }}>
                {run.workflowId?.name || 'Run Detail'}
              </h1>
              <StatusBadge status={run.status} size="md" />
            </div>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Hash size={11} /> {run._id}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={11} /> {new Date(run.createdAt).toLocaleString()}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--accent)' }}>{run.stepCount || 0}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Steps</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>{run.maxSteps}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Max Steps</div>
            </div>
          </div>
        </div>

        {run.failureReason && (
          <div style={{
            marginTop: '16px',
            padding: '10px 14px',
            background: 'var(--danger-light)',
            border: '1px solid var(--danger)30',
            borderRadius: 6,
            fontSize: '13px',
            color: 'var(--danger)',
          }}>
            ❌ {run.failureReason}
          </div>
        )}
      </motion.div>

      {/* Steps Trace */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '20px',
      }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>
          Step Trace ({steps.length} steps)
        </h2>
        {steps.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px', fontSize: '14px' }}>
            No steps executed yet...
          </div>
        ) : (
          steps.map((step, i) => <StepRow key={step._id} step={step} index={i} />)
        )}
      </div>
    </div>
  );
};

export default RunDetail;