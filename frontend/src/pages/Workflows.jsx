import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getWorkflows, publishWorkflow, triggerRun, deleteWorkflow } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import Loader from '../components/Loader';
import WorkflowFlowModal from '../components/WorkflowFlowModal';
import { GitBranch, Upload, Zap, Plus, Pencil, X, Trash2, Workflow } from 'lucide-react';

const BUILTIN_WORKFLOW_NAMES = [
  'GitHub Repository Health Check',
  'Purchase Request Approval',
  'Production Incident Escalation',
  'E-Commerce Order Processing',
  'Support Ticket Router',
  'Employee Expense Reimbursement',
];

const TriggerModal = ({ workflow, onClose, onTriggered }) => {
  const inputSchema = workflow.inputSchema;
  const [inputText, setInputText] = useState(() =>
    JSON.stringify(inputSchema?.example || {}, null, 2)
  );
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTrigger = async () => {
    setError('');
    let parsedInput;
    try {
      parsedInput = JSON.parse(inputText);
    } catch {
      setError('Invalid JSON — check your syntax');
      return;
    }
    setLoading(true);
    try {
      const res = await triggerRun(workflow._id, parsedInput);
      onTriggered(res.data.data._id);
    } catch (err) {
      setError(err.response?.data?.error || 'Trigger failed');
    }
    setLoading(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 480, background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 14, padding: 24,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Trigger: {workflow.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Edit the example input JSON, then trigger the run
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', color: 'var(--text-muted)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          rows={8}
          placeholder='{"message": "Your workflow input"}'
          style={{
            width: '100%', padding: 12, borderRadius: 8,
            border: `1px solid ${error ? 'var(--danger)' : 'var(--border)'}`,
            background: 'var(--bg-secondary)', color: 'var(--text-primary)',
            fontSize: 13, fontFamily: 'monospace', resize: 'vertical',
          }}
        />

        {inputSchema?.fields && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
            Required fields: {Object.entries(inputSchema.fields)
              .filter(([, field]) => field.required)
              .map(([name, field]) => `${name} (${field.type})`)
              .join(', ')}
          </div>
        )}
        {inputSchema?.note && (
          <div style={{
            fontSize: 12,
            color: 'var(--warning)',
            background: 'var(--warning-light)',
            borderRadius: 6,
            padding: '9px 11px',
            marginTop: 10,
          }}>
            {inputSchema.note}
          </div>
        )}

        {error && (
          <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 8 }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: 10, borderRadius: 8,
              background: 'var(--bg-hover)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500,
              border: '1px solid var(--border)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleTrigger}
            disabled={loading}
            style={{
              flex: 1, padding: 10, borderRadius: 8,
              background: 'var(--accent)', color: 'white', fontSize: 13, fontWeight: 600,
            }}
          >
            {loading ? 'Triggering...' : 'Trigger Run'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

const Workflows = () => {
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState(null);
  const [triggerTarget, setTriggerTarget] = useState(null);
  const [flowTarget, setFlowTarget] = useState(null);
  const builtinWorkflows = BUILTIN_WORKFLOW_NAMES
    .map((name) => workflows.find((workflow) => workflow.isTemplate && workflow.name === name))
    .filter(Boolean);
  const myWorkflows = workflows.filter((workflow) => !workflow.isTemplate);

  const fetchWorkflows = async () => {
    try {
      const res = await getWorkflows();
      setWorkflows(res.data.data || []);
      setLoadError('');
    } catch (err) {
      console.error(err);
      setLoadError(err.response?.data?.error || 'Could not load workflows. Check the backend connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    getWorkflows()
      .then((res) => {
        if (active) {
          setWorkflows(res.data.data || []);
          setLoadError('');
        }
      })
      .catch((err) => {
        console.error(err);
        if (active) {
          setLoadError(err.response?.data?.error || 'Could not load workflows. Check the backend connection and try again.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, []);

  const handlePublish = async (id) => {
    try {
      await publishWorkflow(id);
      setMessage({ type: 'success', text: 'Workflow published!' });
      fetchWorkflows();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Publish failed' });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await deleteWorkflow(id);
      setMessage({ type: 'success', text: 'Workflow deleted' });
      fetchWorkflows();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Delete failed' });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleTriggered = (runId) => {
    setTriggerTarget(null);
    setMessage({ type: 'success', text: `Run started! ID: ${runId.slice(-8)}` });
    setTimeout(() => setMessage(null), 4000);
    navigate(`/runs/${runId}`);
  };

  if (loading) return <Loader />;

  return (
    <div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '4px' }}>Workflows</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Design and run automated processes with approvals, integrations, and clear execution history.
          </p>
        </div>
        <button
          onClick={() => navigate('/workflows/new')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 18px', borderRadius: 'var(--radius-sm)',
            background: 'var(--accent)', color: 'white',
            fontSize: 13, fontWeight: 600, flexShrink: 0,
          }}
        >
          <Plus size={15} /> New Workflow
        </button>
      </motion.div>

      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{
              padding: '12px 16px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '14px',
              background: message.type === 'success' ? 'var(--success-light)' : 'var(--danger-light)',
              color: message.type === 'success' ? 'var(--success)' : 'var(--danger)',
              border: `1px solid ${message.type === 'success' ? 'var(--success)' : 'var(--danger)'}30`,
            }}
          >
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 17, fontWeight: 650, marginBottom: 6 }}>Ready-to-run workflows</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 14 }}>
          Six built-in workflows are ready to trigger. View Flow shows each workflow’s steps and approval branches.
        </p>
        {loadError && (
          <div style={{
            padding: 12,
            marginBottom: 14,
            borderRadius: 8,
            color: 'var(--danger)',
            background: 'var(--danger-light)',
            fontSize: 13,
          }}>
            {loadError}
            <button
              onClick={() => {
                setLoading(true);
                fetchWorkflows();
              }}
              style={{ marginLeft: 12, color: 'var(--danger)', textDecoration: 'underline' }}
            >
              Retry
            </button>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {builtinWorkflows.map((wf, i) => (
            <motion.div
              key={wf._id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                <div
                  onClick={() => wf.status === 'draft' && navigate(`/workflows/${wf._id}/edit`)}
                  style={{ display: 'flex', gap: '14px', flex: 1, minWidth: 0, cursor: wf.status === 'draft' ? 'pointer' : 'default' }}
                >
                  <div style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <GitBranch size={18} color="var(--accent)" />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>{wf.name}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      {wf.description || 'No description'}
                    </div>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <StatusBadge status={wf.status} />
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{wf.nodes?.length || 0} nodes</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{wf.triggerType}</span>
                      {wf.isTemplate && (
                        <span style={{ fontSize: '11px', color: 'var(--accent)', background: 'var(--accent-light)', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
                          TEMPLATE
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  {wf.status === 'draft' && (
                    <>
                      <button
                        onClick={() => navigate(`/workflows/${wf._id}/edit`)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-hover)', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500, border: '1px solid var(--border)' }}
                      >
                        <Pencil size={14} /> Edit
                      </button>
                      <button
                        onClick={() => handlePublish(wf._id)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--accent)', color: 'white', fontSize: '13px', fontWeight: 600 }}
                      >
                        <Upload size={14} /> Publish
                      </button>
                      <button
                        onClick={() => handleDelete(wf._id, wf.name)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--danger-light)', color: 'var(--danger)' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                  {wf.status === 'published' && (
                    <>
                      <button
                        onClick={() => setFlowTarget(wf)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-hover)', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 500, border: '1px solid var(--border)' }}
                      >
                        <Workflow size={14} /> View Flow
                      </button>
                      <button
                        onClick={() => setTriggerTarget(wf)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: 'var(--radius-sm)', background: 'var(--accent)', color: 'white', fontSize: '13px', fontWeight: 600 }}
                      >
                        <Zap size={14} /> Trigger Run
                      </button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        {!loadError && builtinWorkflows.length === 0 && (
          <div style={{
            padding: 16,
            borderRadius: 8,
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
            fontSize: 13,
          }}>
            No built-in workflows were returned by the backend. Reload this page; if they are still missing, redeploy/restart the backend so it can restore the shared workflows.
          </div>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: 17, fontWeight: 650, marginBottom: 6 }}>My Workflows</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 14 }}>
          Workflows you create appear here. They stay separate from the built-in workflows above.
        </p>
        {myWorkflows.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {myWorkflows.map((wf, i) => (
              <motion.div
                key={wf._id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                  <div
                    onClick={() => wf.status === 'draft' && navigate(`/workflows/${wf._id}/edit`)}
                    style={{ display: 'flex', gap: '14px', flex: 1, minWidth: 0, cursor: wf.status === 'draft' ? 'pointer' : 'default' }}
                  >
                    <div style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <GitBranch size={18} color="var(--accent)" />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>{wf.name}</div>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        {wf.description || 'No description'}
                      </div>
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <StatusBadge status={wf.status} />
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{wf.nodes?.length || 0} nodes</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{wf.triggerType}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    {wf.status === 'draft' ? (
                      <>
                        <button
                          onClick={() => navigate(`/workflows/${wf._id}/edit`)}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-hover)', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500, border: '1px solid var(--border)' }}
                        >
                          <Pencil size={14} /> Edit
                        </button>
                        <button
                          onClick={() => handlePublish(wf._id)}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--accent)', color: 'white', fontSize: '13px', fontWeight: 600 }}
                        >
                          <Upload size={14} /> Publish
                        </button>
                        <button
                          onClick={() => handleDelete(wf._id, wf.name)}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--danger-light)', color: 'var(--danger)' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setFlowTarget(wf)}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-hover)', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 500, border: '1px solid var(--border)' }}
                        >
                          <Workflow size={14} /> View Flow
                        </button>
                        <button
                          onClick={() => setTriggerTarget(wf)}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: 'var(--radius-sm)', background: 'var(--accent)', color: 'white', fontSize: '13px', fontWeight: 600 }}
                        >
                          <Zap size={14} /> Trigger Run
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      <AnimatePresence>
        {triggerTarget && (
          <TriggerModal
            workflow={triggerTarget}
            onClose={() => setTriggerTarget(null)}
            onTriggered={handleTriggered}
          />
        )}
      </AnimatePresence>
      {flowTarget && (
        <WorkflowFlowModal workflow={flowTarget} onClose={() => setFlowTarget(null)} />
      )}
    </div>
  );
};

export default Workflows;