const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/index');
const Workflow = require('../src/models/Workflow');

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/relay-test');
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

afterEach(async () => {
  await Workflow.deleteMany({});
});

describe('Workflow API', () => {
  // ─── Create Workflow ───────────────────────────────────────────
  test('should create a draft workflow', async () => {
    const res = await request(app)
      .post('/api/workflows')
      .send({
        name: 'Test Workflow',
        description: 'A test workflow',
        triggerType: 'manual',
        nodes: [],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.name).toBe('Test Workflow');
  });

  // ─── List Workflows ────────────────────────────────────────────
  test('should list all workflows', async () => {
    await Workflow.create({ name: 'WF1', nodes: [], entryNodeId: null });
    await Workflow.create({ name: 'WF2', nodes: [], entryNodeId: null });

    const res = await request(app).get('/api/workflows');

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
  });

  // ─── Publish Validation ────────────────────────────────────────
  test('should reject publish if no nodes', async () => {
    const wf = await Workflow.create({
      name: 'Empty WF',
      nodes: [],
      entryNodeId: null,
    });

    const res = await request(app)
      .post(`/api/workflows/${wf._id}/publish`);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/node/i);
  });

  // ─── Publish Validation: entryNodeId ──────────────────────────
  test('should reject publish if entryNodeId missing', async () => {
    const wf = await Workflow.create({
      name: 'No Entry WF',
      nodes: [{ id: 'n1', type: 'notify', name: 'Test', config: {}, next: [] }],
      entryNodeId: null,
    });

    const res = await request(app)
      .post(`/api/workflows/${wf._id}/publish`);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/entryNodeId/i);
  });

  // ─── Publish Success ───────────────────────────────────────────
  test('should publish a valid workflow and freeze it', async () => {
    const wf = await Workflow.create({
      name: 'Valid WF',
      nodes: [{ id: 'n1', type: 'notify', name: 'Notify', config: { message: 'hi', channel: 'console' }, next: [] }],
      entryNodeId: 'n1',
    });

    const res = await request(app)
      .post(`/api/workflows/${wf._id}/publish`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('published');
    expect(res.body.data.publishedDefinition).toBeDefined();
    expect(res.body.data.webhookSecret).toBeDefined();
  });

  // ─── Cannot Edit Published ─────────────────────────────────────
  test('should not allow editing a published workflow', async () => {
    const wf = await Workflow.create({
      name: 'Published WF',
      status: 'published',
      nodes: [{ id: 'n1', type: 'notify', name: 'N', config: {}, next: [] }],
      entryNodeId: 'n1',
    });

    const res = await request(app)
      .put(`/api/workflows/${wf._id}`)
      .send({ name: 'Hacked Name' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/published/i);
  });

  // ─── Cannot Delete Published ───────────────────────────────────
  test('should not allow deleting a published workflow', async () => {
    const wf = await Workflow.create({
      name: 'Published WF',
      status: 'published',
      nodes: [{ id: 'n1', type: 'notify', name: 'N', config: {}, next: [] }],
      entryNodeId: 'n1',
    });

    const res = await request(app)
      .delete(`/api/workflows/${wf._id}`);

    expect(res.status).toBe(400);
  });
});