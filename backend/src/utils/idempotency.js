const { v4: uuidv4 } = require('uuid');

// Generate idempotency key for a run step
const generateIdempotencyKey = (runId, nodeId) => {
  return `${runId}:${nodeId}`;
};

// Generate a unique run ID
const generateRunKey = () => {
  return uuidv4();
};

// Check if a string looks like a prompt injection attempt
const containsInjection = (value) => {
  if (typeof value !== 'string') return false;
  const patterns = [
    'ignore previous',
    'disregard',
    'forget instructions',
    'system prompt',
    'jailbreak',
    'bypass',
    'override instructions',
  ];
  const lower = value.toLowerCase();
  return patterns.some((p) => lower.includes(p));
};

// Deep sanitize an object
const sanitizeInput = (input) => {
  if (typeof input === 'string') {
    return containsInjection(input) ? '[SANITIZED]' : input;
  }
  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }
  if (typeof input === 'object' && input !== null) {
    const result = {};
    for (const [key, value] of Object.entries(input)) {
      result[key] = sanitizeInput(value);
    }
    return result;
  }
  return input;
};

module.exports = {
  generateIdempotencyKey,
  generateRunKey,
  containsInjection,
  sanitizeInput,
};