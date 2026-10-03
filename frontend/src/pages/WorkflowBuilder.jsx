import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, Upload, ArrowLeft, Play } from 'lucide-react';
import NodePalette from '../components/builder/NodePalette';
import PropertiesPanel from '../components/builder/PropertiesPanel';
import CustomNode from '../components/builder/CustomNode';
import { NODE_TYPES } from '../components/builder/nodeConfig';
import { getWorkflow, createWorkflow, updateWorkflow, publishWorkflow, triggerRun } from '../services/api';

const nodeTypes = { custom: CustomNode };
let idCounter = 1;
const getId = () => `node-${Date.now()}-${idCounter++}`;

const WorkflowBuilderInner = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const reactFlowWrapper = useRef(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [workflowName, setWorkflowName] = useState('Untitled Workflow');
  const [workflowDesc, setWorkflowDesc] = useState('');
  const [workflowId, setWorkflowId] = useState(id || null);
  const [status, setStatus] = useState('draft');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(!!id);

  // Load existing workflow if editing
  useEffect(() => {
    if (!id) return;
    getWorkflow(id).then((res) => {
      const wf = res.data.data;
      setWorkflowName(wf.name);
      setWorkflowDesc(wf.description || '');
      setStatus(wf.status);

      const loadedNodes = (wf.nodes || []).map((n, i) => ({
        id: n.id,
        type: 'custom',
        position: n.position || { x: 250, y: 100 + i * 120 },
        data: { nodeType: n.type, label: n.name, config: n.config || {} },
      }));

      const loadedEdges = [];
      (wf.nodes || []).forEach((n) => {
        if (n.type === 'condition') {
          if (n.onTrue) loadedEdges.push({ id: `e-${n.id}-true`, source: n.id, sourceHandle: 'true', target: n.onTrue, style: { stroke: '#22c55e' } });
          if (n.onFalse) loadedEdges.push({ id: `e-${n.id}-false`, source: n.id, sourceHandle: 'false', target: n.onFalse, style: { stroke: '#ef4444' } });
        } else {
          (n.next || []).forEach((nextId) => {
            loadedEdges.push({ id: `e-${n.id}-${nextId}`, source: n.id, target: nextId });
          });
        }
      });

      setNodes(loadedNodes);
      setEdges(loadedEdges);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  const onConnect = useCallback((params) => {
    const sourceNode = nodes.find((n) => n.id === params.source);
    const isCondition = sourceNode?.data?.nodeType === 'condition';
    const color = isCondition ? (params.sourceHandle === 'true' ? '#22c55e' : '#ef4444') : 'var(--accent)';
    setEdges((eds) => addEdge({ ...params, style: { stroke: color, strokeWidth: 1.5 } }, eds));
  }, [nodes, setEdges]);

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/reactflow');
    if (!type || !reactFlowInstance) return;

    const bounds = reactFlowWrapper.current.getBoundingClientRect();
    const position = reactFlowInstance.project({
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    });

    const config = NODE_TYPES[type];
    const newNode = {
      id: getId(),
      type: 'custom',
      position,
      data: {
        nodeType: type,
        label: config.label,
        config: { ...config.defaultConfig },
      },
    };
    setNodes((nds) => nds.concat(newNode));
  }, [reactFlowInstance, setNodes]);

  const onNodeClick = useCallback((_, node) => setSelectedNode(node), []);
  const onPaneClick = useCallback(() => setSelectedNode(null), []);

  const handleUpdateNode = (nodeId, newData) => {
    setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, ...newData } } : n));
    setSelectedNode(null);
  };

  const handleDeleteNode = (nodeId) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setSelectedNode(null);
  };

  // Convert canvas state -> backend node format
  const buildNodesPayload = () => {
    return nodes.map((n) => {
      const outgoing = edges.filter((e) => e.source === n.id);
      const base = {
        id: n.id,
        type: n.data.nodeType,
        name: n.data.label || NODE_TYPES[n.data.nodeType]?.label,
        config: n.data.config || {},
        position: n.position,
      };
      if (n.data.nodeType === 'condition') {
        const trueEdge = outgoing.find((e) => e.sourceHandle === 'true');
        const falseEdge = outgoing.find((e) => e.sourceHandle === 'false');
        return { ...base, onTrue: trueEdge?.target || null, onFalse: falseEdge?.target || null, next: [] };
      }
      return { ...base, next: outgoing.map((e) => e.target) };
    });
  };

  const findEntryNode = () => {
    const targets = new Set(edges.map((e) => e.target));
    const entry = nodes.find((n) => !targets.has(n.id));
    return entry?.id || nodes[0]?.id || null;
  };

  const handleSave = async () => {
    if (nodes.length === 0) {
      setMessage({ type: 'error', text: 'Add at least one node before saving' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: workflowName,
        description: workflowDesc,
        triggerType: 'manual',
        nodes: buildNodesPayload(),
        entryNodeId: findEntryNode(),
      };

      if (workflowId) {
        await updateWorkflow(workflowId, payload);
      } else {
        const res = await createWorkflow(payload);
        setWorkflowId(res.data.data._id);
      }
      setMessage({ type: 'success', text: 'Workflow saved!' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Save failed' });
    }
    setSaving(false);
    setTimeout(() => setMessage(null), 3000);
  };

  const handlePublish = async () => {
    if (!workflowId) {
      setMessage({ type: 'error', text: 'Save the workflow first' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }
    try {
      await publishWorkflow(workflowId);
      setStatus('published');
      setMessage({ type: 'success', text: 'Published! Ready to run.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Publish failed' });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleTriggerTest = async () => {
    try {
      const res = await triggerRun(workflowId, { test: true, triggeredAt: new Date().toISOString() });
      navigate(`/runs/${res.data.data._id}`);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Trigger failed' });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  if (loading) {
    return <div style={{ padding: 40, color: 'var(--text-muted)' }}>Loading workflow...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%' }}>
      {/* Top bar */}
      <div style={{
        height: 60,
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 16,
        background: 'var(--bg-secondary)',
        flexShrink: 0,
      }}>
        <button onClick={() => navigate('/workflows')} style={{ background: 'none', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <ArrowLeft size={16} /> Back
        </button>

        <div style={{ width: 1, height: 24, background: 'var(--border)' }} />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 400 }}>
          <input
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            disabled={status === 'published'}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-primary)',
              fontSize: 15,
              fontWeight: 600,
              padding: 0,
              outline: 'none',
            }}
          />
          <input
            value={workflowDesc}
            onChange={(e) => setWorkflowDesc(e.target.value)}
            disabled={status === 'published'}
            placeholder="Add a description..."
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: 11,
              padding: 0,
              outline: 'none',
            }}
          />
        </div>

        <AnimatePresence>
          {message && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              style={{
                fontSize: 12,
                padding: '6px 12px',
                borderRadius: 6,
                background: message.type === 'success' ? 'var(--success-light)' : 'var(--danger-light)',
                color: message.type === 'success' ? 'var(--success)' : 'var(--danger)',
              }}
            >
              {message.text}
            </motion.div>
          )}
        </AnimatePresence>

        {status === 'published' && (
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--success)', background: 'var(--success-light)', padding: '4px 10px', borderRadius: 20 }}>
            PUBLISHED
          </span>
        )}

        {status !== 'published' && (
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 6,
              background: 'var(--bg-hover)', color: 'var(--text-primary)',
              fontSize: 13, fontWeight: 500, border: '1px solid var(--border)',
            }}
          >
            <Save size={14} /> {saving ? 'Saving...' : 'Save'}
          </button>
        )}

        {status !== 'published' && workflowId && (
          <button
            onClick={handlePublish}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 6,
              background: 'var(--accent)', color: 'white',
              fontSize: 13, fontWeight: 600,
            }}
          >
            <Upload size={14} /> Publish
          </button>
        )}

        {status === 'published' && (
          <button
            onClick={handleTriggerTest}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 6,
              background: 'var(--accent)', color: 'white',
              fontSize: 13, fontWeight: 600,
            }}
          >
            <Play size={14} /> Test Run
          </button>
        )}
      </div>

      {/* Body: palette + canvas + properties */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <NodePalette />

        <div ref={reactFlowWrapper} style={{ flex: 1, background: 'var(--bg-primary)' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onInit={setReactFlowInstance}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background color="var(--border)" gap={20} size={1} />
            <Controls style={{ button: { background: 'var(--bg-card)' } }} />
            <MiniMap
              style={{ background: 'var(--bg-card)' }}
              maskColor="rgba(0,0,0,0.6)"
              nodeColor={(n) => NODE_TYPES[n.data?.nodeType]?.color || '#888'}
            />
          </ReactFlow>

          {nodes.length === 0 && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: 'calc(50% + 110px)',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: 13,
              pointerEvents: 'none',
            }}>
              Drag a node from the left panel to get started
            </div>
          )}
        </div>

        {selectedNode && (
          <PropertiesPanel
            node={selectedNode}
            onUpdate={handleUpdateNode}
            onClose={() => setSelectedNode(null)}
            onDelete={handleDeleteNode}
          />
        )}
      </div>
    </div>
  );
};

const WorkflowBuilder = () => (
  <ReactFlowProvider>
    <WorkflowBuilderInner />
  </ReactFlowProvider>
);

export default WorkflowBuilder;