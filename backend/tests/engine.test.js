const mongoose = require('mongoose');
const WorkflowEngine = require('../src/engine/WorkflowEngine');
const Run = require('../src/models/Run');
const Step = require('../src/models/Step');
const Approval = require('../src/models/Approval');
const { mockAdapter } = require('../src/adapters/aiAdapter');

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/relay-test');
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

afterEach(async () => {
  await Run.deleteMany({});
  await Step.deleteMany({});
  await Approval.deleteMany({});
});

const makeRun = async (nodes, entryNodeId, input = {}) => {
  return Run.create({
    workflowId: new mongoose.Types.ObjectId(),
    definitionSnapshot: { nodes, entryNodeId },
    input,
    status: 'pending',
    maxSteps: 100,
  });
};

describe('WorkflowEngine', () => {
  const engine = new WorkflowEngine(mockAdapter);

  // ─── Notify Node ────────────────────────────────────────────────
  test('should execute a simple notify node and complete', async () => {
    const run = await makeRun(
      [{ id: 'n1', type: 'notify', name: 'Hello', config: { message: 'Hello World', channel: 'console' }, next: [] }],
      'n1'
    );

    await engine.execute(run._id.toString());

    const updated = await Run.findById(run._id);
    expect(updated.status).toBe('completed');

    const steps = await Step.find({ runId: run._id });
    expect(steps.length).toBe(1);
    expect(steps[0].status).toBe('completed');
  });

  // ─── Condition Node ─────────────────────────────────────────────
  test('should branch correctly on condition node', async () => {
    const run = await makeRun(
      [
        {
          id: 'n1', type: 'condition', name: 'Check',
          config: { field: 'amount', operator: 'gt', value: 100 },
          onTrue: 'n2', onFalse: 'n3', next: [],
        },
        { id: 'n2', type: 'notify', name: 'High', config: { message: 'High value', channel: 'console' }, next: [] },
        { id: 'n3', type: 'notify', name: 'Low', config: { message: 'Low value', channel: 'console' }, next: [] },
      ],
      'n1',
      { amount: 200 }
    );

    await engine.execute(run._id.toString());

    const updated = await Run.findById(run._id);
    expect(updated.status).toBe('completed');

    const steps = await Step.find({ runId: run._id });
    const nodeIds = steps.map((s) => s.nodeId);
    expect(nodeIds).toContain('n2');
    expect(nodeIds).not.toContain('n3');
  });

  // ─── Step Cap ───────────────────────────────────────────────────
  test('should stop at max step cap — runaway workflow protection', async () => {
    const run = await Run.create({
      workflowId: new mongoose.Types.ObjectId(),
      definitionSnapshot: {
        nodes: [
          { id: 'n1', type: 'notify', name: 'Loop', config: { message: 'looping', channel: 'console' }, next: ['n1'] },
        ],
        entryNodeId: 'n1',
      },
      input: {},
      status: 'pending',
      maxSteps: 5,
    });

    await engine.execute(run._id.toString());

    const updated = await Run.findById(run._id);
    expect(updated.status).toBe('failed');
    expect(updated.failureReason).toMatch(/step cap/i);
  });

  // ─── Crash Recovery (Idempotency) ───────────────────────────────
  test('should resume from last completed step after crash', async () => {
    const run = await makeRun(
      [
        { id: 'n1', type: 'notify', name: 'Step1', config: { message: 'Step 1', channel: 'console' }, next: ['n2'] },
        { id: 'n2', type: 'notify', name: 'Step2', config: { message: 'Step 2', channel: 'console' }, next: [] },
      ],
      'n1'
    );

    // Simulate n1 already completed (crash recovery scenario)
    await Step.create({
      runId: run._id,
      nodeId: 'n1',
      nodeType: 'notify',
      nodeName: 'Step1',
      status: 'completed',
      input: {},
      output: { notified: true },
      idempotencyKey: `${run._id}:n1`,
      startedAt: new Date(),
      completedAt: new Date(),
    });

    await engine.execute(run._id.toString());

    const updated = await Run.findById(run._id);
    expect(updated.status).toBe('completed');

    // n1 should NOT be re-executed
    const n1Steps = await Step.find({ runId: run._id, nodeId: 'n1' });
    expect(n1Steps.length).toBe(1); // Only the pre-existing one
  });

  // ─── Approval Gate ──────────────────────────────────────────────
  test('should pause run at approval node', async () => {
    const run = await makeRun(
      [
        { id: 'n1', type: 'approval', name: 'Need Approval', config: {}, next: ['n2'] },
        { id: 'n2', type: 'notify', name: 'After Approval', config: { message: 'done', channel: 'console' }, next: [] },
      ],
      'n1'
    );

    await engine.execute(run._id.toString());

    const updated = await Run.findById(run._id);
    expect(updated.status).toBe('paused');

    const approval = await Approval.findOne({ runId: run._id });
    expect(approval).toBeTruthy();
    expect(approval.status).toBe('pending');
  });
});