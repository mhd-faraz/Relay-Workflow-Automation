const axios = require('axios');
const env = require('../config/env');
const Approval = require('../models/Approval');
const ExpenseClaim = require('../models/ExpenseClaim');

const TIMEOUT_MS = 10000;

// ─── HTTP Request Node ───────────────────────────────────────────
const runHttpRequest = async (config, input) => {
  const url = resolveTemplate(config.url, input);
  const method = (config.method || 'GET').toLowerCase();
  const headers = config.headers || {};
  const body = config.body ? resolveTemplateObj(config.body, input) : undefined;

  const response = await axios({
    method,
    url,
    headers,
    data: body,
    timeout: TIMEOUT_MS,
  });

  return {
    status: response.status,
    data: response.data,
  };
};

// ─── Condition Node ──────────────────────────────────────────────
const runCondition = async (config, input) => {
  const { field, operator, value } = config;
  const actual = getNestedValue(input, field);

  let result = false;
  switch (operator) {
    case 'eq':       result = actual == value; break;
    case 'neq':      result = actual != value; break;
    case 'gt':       result = actual > value; break;
    case 'lt':       result = actual < value; break;
    case 'gte':      result = actual >= value; break;
    case 'lte':      result = actual <= value; break;
    case 'contains': result = String(actual).includes(String(value)); break;
    case 'exists':   result = actual !== undefined && actual !== null; break;
    default: throw new Error(`Unknown operator: ${operator}`);
  }

  return { result, field, operator, value, actual };
};

// ─── Delay Node ──────────────────────────────────────────────────
const runDelay = async (config) => {
  const ms = config.durationMs || 1000;
  await new Promise((resolve) => setTimeout(resolve, Math.min(ms, 30000)));
  return { delayed: true, durationMs: ms };
};

// ─── Notify Node ─────────────────────────────────────────────────
const runNotify = async (config, input) => {
  const message = resolveTemplate(config.message || 'Notification', input);
  const channel = config.channel || 'console';
  console.log(`[NOTIFY][${channel}] ${message}`);
  return { notified: true, channel, message };
};

const runExpenseClaim = async (config, input, { runId, userId }) => {
  const fields = resolveTemplateObj(config.fields, input);
  const requiresApproval = fields.amount > config.autoApprovalLimit;
  let approval = null;

  if (config.approvalNodeId) {
    approval = await Approval.findOne({ runId, nodeId: config.approvalNodeId });
  }

  if (approval?.status === 'rejected') {
    throw new Error('Rejected expense claim cannot be recorded');
  }
  if (requiresApproval && approval?.status !== 'approved') {
    throw new Error('Expense claims above the auto-approval limit require manager approval');
  }

  const status = requiresApproval ? 'approved' : 'auto_approved';
  let claim;
  try {
    claim = await ExpenseClaim.findOneAndUpdate(
      { runId, nodeId: config.nodeId },
      {
        $setOnInsert: {
          runId,
          userId,
          nodeId: config.nodeId,
          ...fields,
          currency: 'INR',
          status,
          approvedBy: approval?.resolvedBy || null,
          approvedAt: approval?.resolvedAt || null,
        },
      },
      { new: true, upsert: true, runValidators: true }
    );
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.claimReference) {
      throw new Error(`Expense claim reference "${fields.claimReference}" has already been used`);
    }
    throw error;
  }

  return {
    expenseClaim: {
      recordId: claim._id.toString(),
      claimReference: claim.claimReference,
      status: claim.status,
      amount: claim.amount,
      currency: claim.currency,
      approvedBy: claim.approvedBy,
      createdAt: claim.createdAt,
    },
  };
};

// ─── AI Node ─────────────────────────────────────────────────────
const runAiNode = async (config, input, aiAdapter) => {
  const prompt = resolveTemplate(config.prompt, input);
  const schema = config.outputSchema || null;

  const result = await aiAdapter.complete(prompt, { timeout: TIMEOUT_MS });

  const raw = (typeof result === 'object' && result.text) ? result.text : result;
  const tokenUsage = (typeof result === 'object' && result.tokenUsage) ? result.tokenUsage : {};

  let cleaned = typeof raw === 'string' ? raw.trim() : raw;
  if (typeof cleaned === 'string') {
    cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }
  }

  console.log('[AI DEBUG] Raw AI output:', cleaned);

  if (schema) {
    const validated = validateAgainstSchema(cleaned, schema);
    if (!validated.valid) {
      throw new Error(`AI output schema validation failed: ${validated.error}`);
    }
    return {
      raw: cleaned,
      parsed: validated.data,
      schemaValidated: true,
      tokenUsage,
    };
  }

  return {
    raw: cleaned,
    schemaValidated: false,
    tokenUsage,
  };
};

// ─── Approval Node ───────────────────────────────────────────────
const runApprovalNode = async (config, runId, nodeId, nodeName, input, ApprovalModel) => {
  const existing = await ApprovalModel.findOne({ runId, nodeId });

  if (existing && existing.status === 'approved') {
    return { approval: { approved: true, resolvedBy: existing.resolvedBy } };
  }

  if (existing && existing.status === 'rejected') {
    throw new Error(`Run rejected at approval node: ${nodeName}`);
  }

  if (!existing) {
    await ApprovalModel.create({
      runId,
      nodeId,
      nodeName,
      status: 'pending',
      context: input,
    });
  }

  const err = new Error('APPROVAL_PENDING');
  err.code = 'APPROVAL_PENDING';
  throw err;
};

// ─── Helpers ─────────────────────────────────────────────────────
const resolveTemplate = (template, data) => {
  if (typeof template !== 'string') return template;
  return template.replace(/\{\{([\w.]+)\}\}/g, (_, path) => {
    return getNestedValue(data, path) ?? '';
  });
};

const resolveTemplateObj = (obj, data) => {
  if (typeof obj === 'string') return resolveTemplate(obj, data);
  if (Array.isArray(obj)) return obj.map((item) => resolveTemplateObj(item, data));
  if (typeof obj === 'object' && obj !== null) {
    const result = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = resolveTemplateObj(v, data);
    }
    return result;
  }
  return obj;
};

const getNestedValue = (obj, path) => {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
};

const validateAgainstSchema = (raw, schema) => {
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    for (const [key, rule] of Object.entries(schema)) {
      if (rule.required && !(key in data)) {
        return { valid: false, error: `Missing required field: ${key}` };
      }
      if (key in data && rule.type && typeof data[key] !== rule.type) {
        return { valid: false, error: `Field ${key} must be of type ${rule.type}` };
      }
    }
    return { valid: true, data };
  } catch (e) {
    return { valid: false, error: `Invalid JSON: ${e.message}` };
  }
};

module.exports = {
  runHttpRequest,
  runCondition,
  runDelay,
  runNotify,
  runExpenseClaim,
  runAiNode,
  runApprovalNode,
  validateAgainstSchema,
};