import { Background, Controls, Handle, MiniMap, Position, ReactFlow, ReactFlowProvider } from 'reactflow';
import 'reactflow/dist/style.css';
import { X } from 'lucide-react';

const FlowNode = ({ data }) => (
  <div style={{
    minWidth: 170,
    padding: '12px 14px',
    borderRadius: 8,
    border: `1px solid ${data.type === 'approval' ? 'var(--warning)' : 'var(--border-light)'}`,
    background: 'var(--bg-card)',
    color: 'var(--text-primary)',
    boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
  }}>
    <Handle type="target" position={Position.Left} />
    <div style={{ fontSize: 12, fontWeight: 600 }}>{data.label}</div>
    <div style={{ fontSize: 10, color: data.type === 'approval' ? 'var(--warning)' : 'var(--text-muted)', marginTop: 5 }}>
      {data.type.replaceAll('_', ' ')}
    </div>
    <Handle type="source" position={Position.Right} />
  </div>
);

const nodeTypes = { flowNode: FlowNode };

const getTargets = (node) => node.type === 'condition'
  ? [node.onTrue, node.onFalse].filter(Boolean)
  : node.next || [];

const buildGraph = (workflow) => {
  const definition = workflow.publishedDefinition || workflow;
  const nodes = definition.nodes || [];
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const levels = new Map();
  const queue = [];
  if (definition.entryNodeId && byId.has(definition.entryNodeId)) {
    levels.set(definition.entryNodeId, 0);
    queue.push(definition.entryNodeId);
  }

  while (queue.length) {
    const sourceId = queue.shift();
    for (const targetId of getTargets(byId.get(sourceId))) {
      if (byId.has(targetId) && !levels.has(targetId)) {
        levels.set(targetId, levels.get(sourceId) + 1);
        queue.push(targetId);
      }
    }
  }

  const maxLevel = Math.max(0, ...levels.values());
  for (const node of nodes) {
    if (!levels.has(node.id)) levels.set(node.id, maxLevel + 1);
  }

  const rowByLevel = new Map();
  const flowNodes = nodes.map((node) => {
    const level = levels.get(node.id);
    const row = rowByLevel.get(level) || 0;
    rowByLevel.set(level, row + 1);
    return {
      id: node.id,
      type: 'flowNode',
      position: { x: 40 + level * 250, y: 40 + row * 125 },
      data: { label: node.name, type: node.type },
    };
  });

  const flowEdges = nodes.flatMap((node) => {
    if (node.type === 'condition') {
      return [
        node.onTrue && {
          id: `${node.id}-true-${node.onTrue}`,
          source: node.id,
          target: node.onTrue,
          label: 'True',
          style: { stroke: '#22c55e' },
          labelStyle: { fill: '#22c55e', fontSize: 11 },
        },
        node.onFalse && {
          id: `${node.id}-false-${node.onFalse}`,
          source: node.id,
          target: node.onFalse,
          label: 'False',
          style: { stroke: '#ef4444' },
          labelStyle: { fill: '#ef4444', fontSize: 11 },
        },
      ].filter(Boolean);
    }
    return (node.next || []).map((targetId) => ({
      id: `${node.id}-${targetId}`,
      source: node.id,
      target: targetId,
      animated: node.type === 'approval',
    }));
  });

  return { nodes: flowNodes, edges: flowEdges };
};

const WorkflowFlowModal = ({ workflow, onClose }) => {
  const graph = buildGraph(workflow);

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        background: 'rgba(0,0,0,0.78)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${workflow.name} workflow diagram`}
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 'min(1100px, 96vw)',
          height: 'min(700px, 88vh)',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{
          minHeight: 58,
          padding: '0 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)',
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{workflow.name} — Flow</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
              Green/red edges show condition branches; approval nodes are highlighted.
            </div>
          </div>
          <button
            type="button"
            aria-label="Close workflow diagram"
            onClick={onClose}
            style={{ background: 'none', color: 'var(--text-secondary)', padding: 6 }}
          >
            <X size={18} />
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <ReactFlowProvider>
            <ReactFlow
              nodes={graph.nodes}
              edges={graph.edges}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="var(--border)" gap={20} size={1} />
              <Controls />
              <MiniMap nodeColor={(node) => node.data?.type === 'approval' ? '#f59e0b' : '#e11d48'} />
            </ReactFlow>
          </ReactFlowProvider>
        </div>
      </div>
    </div>
  );
};

export default WorkflowFlowModal;
