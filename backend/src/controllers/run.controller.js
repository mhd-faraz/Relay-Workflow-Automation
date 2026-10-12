const Run = require('../models/Run');
const Step = require('../models/Step');
const Approval = require('../models/Approval');
const Workflow = require('../models/Workflow');
const { getQueue } = require('../workers/workflowWorker');

const DEMO_INPUT_SCHEMAS = {
  'E-Commerce Order Processing': {
    fields: {
      orderId: { type: 'string', required: true },
      amount: { type: 'number', required: true },
    },
  },
  'Support Ticket Router': {
    fields: {
      message: { type: 'string', required: true },
    },
  },
  'Employee Expense Reimbursement': {
    fields: {
      claimReference: { type: 'string', required: true, maxLength: 40 },
      employeeName: { type: 'string', required: true, maxLength: 100 },
      department: { type: 'string', required: true, maxLength: 100 },
      category: {
        type: 'string',
        required: true,
        enum: ['Travel', 'Meals', 'Software', 'Equipment', 'Other'],
      },
      description: { type: 'string', required: true, maxLength: 1000 },
      amount: { type: 'number', required: true, min: 0.01, max: 1000000 },
    },
  },
};

const INPUT_VALIDATORS = {
  githubOwner: (value) =>
    typeof value === 'string' && /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(value),
  githubRepo: (value) =>
    typeof value === 'string' && /^[A-Za-z0-9._-]{1,100}$/.test(value),
};

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

    const input = req.body.input || {};
    const inputError = validateWorkflowInput(workflow.publishedDefinition, input, workflow);
    if (inputError) return res.status(400).json({ success: false, error: inputError });

    const run = await Run.create({
      userId: req.userId,
      workflowId: workflow._id,
      definitionSnapshot: workflow.publishedDefinition,
      triggerType: 'manual',
      input,
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
    const inputError = validateWorkflowInput(workflow.publishedDefinition, rawPayload, workflow);
    if (inputError) return res.status(400).json({ success: false, error: inputError });
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

// DELETE /api/runs/:id — only failed runs can be removed from run history
const deleteFailedRun = async (req, res) => {
  try {
    const run = await Run.findOne({ _id: req.params.id, userId: req.userId, status: 'failed' });
    if (!run) {
      return res.status(404).json({ success: false, error: 'Failed run not found' });
    }

    await Promise.all([
      Step.deleteMany({ runId: run._id }),
      Approval.deleteMany({ runId: run._id }),
    ]);
    await run.deleteOne();

    res.json({ success: true, message: 'Failed run deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const validateWorkflowInput = (definition, input, workflow = {}) => {
  const schema = definition?.inputSchema || workflow.inputSchema || DEMO_INPUT_SCHEMAS[workflow.name];
  const fields = schema?.fields;
  if (!fields) return null;
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return 'Workflow input must be a JSON object';
  }

  for (const [name, field] of Object.entries(fields)) {
    const value = input[name];
    if (
      field.required
      && (value === undefined || value === null || (typeof value === 'string' && !value.trim()))
    ) {
      return `Input field "${name}" is required`;
    }
    if (value === undefined || value === null) continue;
    if (field.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) {
      return `Input field "${name}" must be a number`;
    }
    if (field.type === 'string' && (typeof value !== 'string' || !value.trim())) {
      return `Input field "${name}" must be a non-empty string`;
    }
    if (field.type === 'string' && field.maxLength && value.length > field.maxLength) {
      return `Input field "${name}" must be at most ${field.maxLength} characters`;
    }
    if (field.enum && !field.enum.includes(value)) {
      return `Input field "${name}" must be one of: ${field.enum.join(', ')}`;
    }
    if (field.type === 'number' && field.min !== undefined && value < field.min) {
      return `Input field "${name}" must be at least ${field.min}`;
    }
    if (field.type === 'number' && field.max !== undefined && value > field.max) {
      return `Input field "${name}" must be at most ${field.max}`;
    }
    if (field.validator) {
      const validator = INPUT_VALIDATORS[field.validator];
      if (!validator) return `Input field "${name}" has an unsupported validator`;
      if (!validator(value)) {
        return `Input field "${name}" must be ${field.validatorDescription || 'in the correct format'}`;
      }
    }
  }

  return null;
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
  deleteFailedRun,
  validateWorkflowInput,
};