const Run = require('../models/Run');
const Step = require('../models/Step');
const Workflow = require('../models/Workflow');
const { getQueue } = require('../workers/workflowWorker');

// POST /api/workflows/:id/trigger — works for own workflows OR templates
const triggerRun = async (req, res) => {
  try {
    const workflow = await Workflow.findOne({
      _id: req.params.id,
      $or: [{ userId: req.userId }, { isTemplate: true }],
    });
    if (!workflow) return res.status(404).json({ success: false, error: 'Workflow not found' });
    if (workflow.status !== 'published') {
      return res.status(400).json({ success: false, error: 'Only published workflows can be triggered' });
    }

    const run = await Run.create({
      userId: req.userId,
      workflowId: workflow._id,
      definitionSnapshot: workflow.publishedDefinition,
      triggerType: 'manual',
      input: req.body.input || {},
      maxSteps: parseInt(req.body.maxSteps) || 100,
    });

    const queue = getQueue();
    await queue.add('run-workflow', { runId: run._id.toString() }, {
      jobId: run._id.toString(),
    });

    res.status(201).json({ success: true, data: run });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// POST /api/webhooks/:id  (webhook trigger — public, uses secret)
const webhookTrigger = async (req, res) => {
  try {
    const workflow = await Workflow.findById(req.params.id);
    if (!workflow) return res.status(404).json({ success: false, error: 'Workflow not found' });
    if (workflow.status !== 'published') {
      return res.status(400).json({ success: false, error: 'Workflow not published' });
    }

    const secret = req.headers['x-webhook-secret'];
    if (!secret || secret !== workflow.webhookSecret) {
      return res.status(401).json({ success: false, error: 'Invalid webhook secret' });
    }

    const rawPayload = req.body;
    const sanitizedPayload = sanitizePayload(rawPayload);

    const run = await Run.create({
      userId: workflow.userId || null,
      workflowId: workflow._id,
      definitionSnapshot: workflow.publishedDefinition,
      triggerType: 'webhook',
      input: sanitizedPayload,
      maxSteps: 100,
    });

    const queue = getQueue();
    await queue.add('run-workflow', { runId: run._id.toString() }, {
      jobId: run._id.toString(),
    });

    res.status(201).json({ success: true, data: { runId: run._id } });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// GET /api/runs — only the current user's own runs (even if triggered from a template)
const listRuns = async (req, res) => {
  try {
    const { workflowId, status } = req.query;
    const filter = { userId: req.userId };
    if (workflowId) filter.workflowId = workflowId;
    if (status) filter.status = status;

    const runs = await Run.find(filter)
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('workflowId', 'name');

    res.json({ success: true, data: runs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/runs/:id
const getRun = async (req, res) => {
  try {
    const run = await Run.findOne({ _id: req.params.id, userId: req.userId }).populate('workflowId', 'name');
    if (!run) return res.status(404).json({ success: false, error: 'Run not found' });
    res.json({ success: true, data: run });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/runs/:id/steps
const getRunSteps = async (req, res) => {
  try {
    const run = await Run.findOne({ _id: req.params.id, userId: req.userId });
    if (!run) return res.status(404).json({ success: false, error: 'Run not found' });

    const steps = await Step.find({ runId: req.params.id }).sort({ createdAt: 1 });
    res.json({ success: true, data: steps });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const sanitizePayload = (payload) => {
  const dangerous = [
    'ignore previous instructions',
    'disregard',
    'system prompt',
    'jailbreak',
    'forget your instructions',
  ];

  const sanitize = (value) => {
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      for (const pattern of dangerous) {
        if (lower.includes(pattern)) {
          console.warn(`[Security] Prompt injection detected: "${pattern}"`);
          return '[SANITIZED]';
        }
      }
      return value;
    }
    if (typeof value === 'object' && value !== null) {
      const result = {};
      for (const [k, v] of Object.entries(value)) {
        result[k] = sanitize(v);
      }
      return result;
    }
    return value;
  };

  return sanitize(payload);
};

module.exports = {
  triggerRun,
  webhookTrigger,
  listRuns,
  getRun,
  getRunSteps,
};