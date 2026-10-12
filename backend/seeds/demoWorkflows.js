require('dotenv').config();
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/relay';

// ─── Demo Workflow 1: E-Commerce Order Processing ────────────────
const orderWorkflow = {
  name: 'E-Commerce Order Processing',
  description: 'Classify an order, request human approval for orders above INR 10,000, then send a simulated request to httpbin.',
  status: 'published',
  triggerType: 'webhook',
  inputSchema: {
    example: { orderId: 'ORD-1001', amount: 25000 },
    fields: {
      orderId: { type: 'string', required: true },
      amount: { type: 'number', required: true },
    },
  },
  inputSchema: {
    example: { orderId: 'ORD-1001', amount: 25000 },
    fields: {
      orderId: { type: 'string', required: true },
      amount: { type: 'number', required: true },
    },
  },
  webhookSecret: uuidv4(),
  entryNodeId: 'node-classify',
  nodes: [
    {
      id: 'node-classify',
      type: 'ai',
      name: 'Classify Order',
      config: {
        prompt: `You are an order classification engine. Analyze this order and respond with JSON only:
Order ID: {{orderId}}
Amount in INR: {{amount}}
Respond with: { "orderType": "standard|express|bulk", "priority": "low|medium|high", "reason": "string" }`,
        outputSchema: {
          orderType: { type: 'string', required: true },
          priority: { type: 'string', required: true },
          reason: { type: 'string', required: true },
        },
      },
      next: ['node-check-approval'],
    },
    {
      id: 'node-check-approval',
      type: 'condition',
      name: 'Needs Approval?',
      config: {
        field: 'amount',
        operator: 'gt',
        value: 10000,
      },
      onTrue: 'node-approval-gate',
      onFalse: 'node-notify-team',
    },
    {
      id: 'node-approval-gate',
      type: 'approval',
      name: 'Manager Approval',
      config: {
        message: 'Order above INR 10,000 requires manager approval',
      },
      next: ['node-notify-team'],
    },
    {
      id: 'node-notify-team',
      type: 'notify',
      name: 'Notify Fulfillment Team',
      config: {
        channel: 'slack',
        message: 'New order received. Priority: {{parsed.priority}}. Type: {{parsed.orderType}}',
      },
      next: ['node-process-payment'],
    },
    {
      id: 'node-process-payment',
      type: 'http_request',
      name: 'Process Payment',
      config: {
        url: 'https://jsonplaceholder.typicode.com/posts',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { orderId: '{{orderId}}', amount: '{{amount}}' },
      },
      next: ['node-complete'],
    },
    {
      id: 'node-complete',
      type: 'notify',
      name: 'Order Complete',
      config: {
        channel: 'console',
        message: 'Order {{orderId}} processed successfully!',
      },
      next: [],
    },
  ],
  publishedAt: new Date(),
};

// ─── Demo Workflow 2: Support Ticket Router ──────────────────────
const supportWorkflow = {
  name: 'Support Ticket Router',
  description: 'AI classifies support tickets and routes to the right team automatically',
  status: 'published',
  triggerType: 'webhook',
  inputSchema: {
    example: { message: 'All customer payments are failing in production; this is a critical outage.' },
    fields: {
      message: { type: 'string', required: true },
    },
  },
  inputSchema: {
    example: { message: 'All customer payments are failing in production; this is a critical outage.' },
    fields: {
      message: { type: 'string', required: true },
    },
  },
  webhookSecret: uuidv4(),
  entryNodeId: 'node-ai-classify',
  nodes: [
    {
      id: 'node-ai-classify',
      type: 'ai',
      name: 'AI Ticket Classifier',
      config: {
        prompt: `Classify this support ticket and respond with JSON only:
Ticket: {{message}}
Respond with: { "category": "billing|technical|general", "urgency": "low|medium|high", "suggestedTeam": "string", "summary": "string" }`,
        outputSchema: {
          category: { type: 'string', required: true },
          urgency: { type: 'string', required: true },
          suggestedTeam: { type: 'string', required: true },
        },
      },
      next: ['node-check-urgency'],
    },
    {
      id: 'node-check-urgency',
      type: 'condition',
      name: 'Is Urgent?',
      config: {
        field: 'parsed.urgency',
        operator: 'eq',
        value: 'high',
      },
      onTrue: 'node-escalate',
      onFalse: 'node-route-ticket',
    },
    {
      id: 'node-escalate',
      type: 'approval',
      name: 'Escalation Approval',
      config: {
        message: 'High urgency ticket needs team lead approval before escalation',
      },
      next: ['node-route-ticket'],
    },
    {
      id: 'node-route-ticket',
      type: 'notify',
      name: 'Route to Team',
      config: {
        channel: 'console',
        message: 'Ticket routed to {{parsed.suggestedTeam}} team. Category: {{parsed.category}}',
      },
      next: ['node-delay'],
    },
    {
      id: 'node-delay',
      type: 'delay',
      name: 'SLA Buffer',
      config: { durationMs: 2000 },
      next: ['node-confirm'],
    },
    {
      id: 'node-confirm',
      type: 'notify',
      name: 'Confirm Routing',
      config: {
        channel: 'console',
        message: 'Support ticket successfully routed. Summary: {{parsed.summary}}',
      },
      next: [],
    },
  ],
  publishedAt: new Date(),
};

// ─── Demo Workflow 3: Content Moderation ────────────────────────
const moderationWorkflow = {
  name: 'Content Moderation Pipeline',
  description: 'AI reviews user-generated content and flags or approves it automatically',
  status: 'published',
  triggerType: 'manual',
  webhookSecret: uuidv4(),
  entryNodeId: 'node-ai-review',
  nodes: [
    {
      id: 'node-ai-review',
      type: 'ai',
      name: 'AI Content Reviewer',
      config: {
        prompt: `Review this content for policy violations and respond with JSON only:
Content: {{content}}
Respond with: { "safe": true|false, "score": 0.0-1.0, "flags": [], "action": "approve|review|reject" }`,
        outputSchema: {
          safe: { type: 'boolean', required: true },
          score: { type: 'number', required: true },
          action: { type: 'string', required: true },
        },
      },
      next: ['node-check-safe'],
    },
    {
      id: 'node-check-safe',
      type: 'condition',
      name: 'Is Content Safe?',
      config: {
        field: 'parsed.safe',
        operator: 'eq',
        value: true,
      },
      onTrue: 'node-approve',
      onFalse: 'node-human-review',
    },
    {
      id: 'node-human-review',
      type: 'approval',
      name: 'Human Review Required',
      config: {
        message: 'AI flagged content — human moderator review needed',
      },
      next: ['node-approve'],
    },
    {
      id: 'node-approve',
      type: 'notify',
      name: 'Content Decision',
      config: {
        channel: 'console',
        message: 'Content moderation complete. Action: {{parsed.action}}. Score: {{parsed.score}}',
      },
      next: [],
    },
  ],
  publishedAt: new Date(),
};

const purchaseWorkflow = {
  name: 'Purchase Request Approval',
  description: 'Route purchasing requests for approval above INR 50,000, then hand off the approved request.',
  status: 'published',
  triggerType: 'manual',
  inputSchema: {
    example: {
      requestId: 'PR-2026-1042',
      department: 'Engineering',
      requestedBy: 'Aarav Sharma',
      item: 'Production database capacity upgrade',
      amount: 85000,
    },
    fields: {
      requestId: { type: 'string', required: true },
      department: { type: 'string', required: true },
      requestedBy: { type: 'string', required: true },
      item: { type: 'string', required: true },
      amount: { type: 'number', required: true },
    },
  },
  entryNodeId: 'purchase-check-threshold',
  nodes: [
    {
      id: 'purchase-check-threshold',
      type: 'condition',
      name: 'Needs Manager Approval?',
      config: { field: 'amount', operator: 'gt', value: 50000 },
      onTrue: 'purchase-manager-approval',
      onFalse: 'purchase-create-request',
      next: [],
    },
    {
      id: 'purchase-manager-approval',
      type: 'approval',
      name: 'Manager Approval',
      config: { message: 'Review this purchase request before it is handed off for procurement.' },
      next: ['purchase-create-request'],
    },
    {
      id: 'purchase-create-request',
      type: 'http_request',
      name: 'Create Procurement Handoff',
      config: {
        url: 'https://jsonplaceholder.typicode.com/posts',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          title: 'Purchase {{requestId}} - {{item}}',
          body: 'Department: {{department}}. Requested by: {{requestedBy}}. Amount: INR {{amount}}.',
          userId: 1,
        },
      },
      next: ['purchase-confirm'],
    },
    {
      id: 'purchase-confirm',
      type: 'notify',
      name: 'Show Procurement Handoff',
      config: {
        channel: 'console',
        message: 'Purchase {{requestId}} for {{item}} (INR {{amount}}) handed off. Demo procurement record ID: {{data.id}}.',
      },
      next: [],
    },
  ],
  publishedAt: new Date(),
};

const incidentWorkflow = {
  name: 'Production Incident Escalation',
  description: 'Pause critical production incidents for incident-commander approval, then create a tracked handoff.',
  status: 'published',
  triggerType: 'manual',
  inputSchema: {
    example: {
      incidentId: 'INC-2026-0081',
      service: 'payments-api',
      severity: 'critical',
      summary: 'Payment requests are timing out for customers.',
    },
    fields: {
      incidentId: { type: 'string', required: true },
      service: { type: 'string', required: true },
      severity: { type: 'string', required: true, enum: ['critical', 'high', 'medium', 'low'] },
      summary: { type: 'string', required: true },
    },
  },
  entryNodeId: 'incident-check-severity',
  nodes: [
    {
      id: 'incident-check-severity',
      type: 'condition',
      name: 'Requires Incident Commander?',
      config: { field: 'severity', operator: 'eq', value: 'critical' },
      onTrue: 'incident-approval',
      onFalse: 'incident-create-handoff',
      next: [],
    },
    {
      id: 'incident-approval',
      type: 'approval',
      name: 'Incident Commander Approval',
      config: { message: 'Approve escalation of this critical production incident.' },
      next: ['incident-create-handoff'],
    },
    {
      id: 'incident-create-handoff',
      type: 'http_request',
      name: 'Create Incident Handoff',
      config: {
        url: 'https://jsonplaceholder.typicode.com/posts',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          title: '[{{severity}}] {{incidentId}} - {{service}}',
          body: '{{summary}}',
          userId: 1,
        },
      },
      next: ['incident-confirm'],
    },
    {
      id: 'incident-confirm',
      type: 'notify',
      name: 'Show Incident Handoff',
      config: {
        channel: 'console',
        message: 'Incident {{incidentId}} for {{service}} handed off as demo record {{data.id}} ({{severity}}).',
      },
      next: [],
    },
  ],
  publishedAt: new Date(),
};

const githubWorkflow = {
  name: 'GitHub Repository Health Check',
  description: 'Enter any public GitHub owner/repository to check stars, open issues, and latest commit.',
  status: 'published',
  triggerType: 'manual',
  inputSchema: {
    example: { owner: 'mhd-faraz', repo: 'Relay-Workflow-Automation' },
    fields: {
      owner: { type: 'string', required: true, validator: 'githubOwner' },
      repo: { type: 'string', required: true, validator: 'githubRepo' },
    },
  },
  entryNodeId: 'github-fetch-stars',
  nodes: [
    {
      id: 'github-fetch-stars',
      type: 'http_request',
      name: 'Fetch Repository Stars',
      config: {
        url: 'https://img.shields.io/github/stars/{{owner}}/{{repo}}.json',
        method: 'GET',
        headers: { Accept: 'application/json' },
        body: {},
      },
      next: ['github-show-stars'],
    },
    {
      id: 'github-show-stars',
      type: 'notify',
      name: 'Show Repository Stars',
      config: { channel: 'console', message: '{{owner}}/{{repo}} has {{data.value}} GitHub stars.' },
      next: ['github-fetch-issues'],
    },
    {
      id: 'github-fetch-issues',
      type: 'http_request',
      name: 'Fetch Open Issues',
      config: {
        url: 'https://img.shields.io/github/issues/{{owner}}/{{repo}}.json',
        method: 'GET',
        headers: { Accept: 'application/json' },
        body: {},
      },
      next: ['github-show-issues'],
    },
    {
      id: 'github-show-issues',
      type: 'notify',
      name: 'Show Open Issues',
      config: { channel: 'console', message: '{{owner}}/{{repo}} has {{data.value}} GitHub issues.' },
      next: ['github-fetch-last-commit'],
    },
    {
      id: 'github-fetch-last-commit',
      type: 'http_request',
      name: 'Fetch Last Commit',
      config: {
        url: 'https://img.shields.io/github/last-commit/{{owner}}/{{repo}}.json',
        method: 'GET',
        headers: { Accept: 'application/json' },
        body: {},
      },
      next: ['github-show-last-commit'],
    },
    {
      id: 'github-show-last-commit',
      type: 'notify',
      name: 'Show Last Commit',
      config: {
        channel: 'console',
        message: 'Latest commit to {{owner}}/{{repo}} was {{data.value}} ago.',
      },
      next: [],
    },
  ],
  publishedAt: new Date(),
};

const expenseWorkflow = {
  name: 'Employee Expense Reimbursement',
  description: 'Validate an employee expense, route claims above INR 5,000 for manager approval, and save the decision to Relay’s auditable expense ledger.',
  status: 'published',
  triggerType: 'manual',
  inputSchema: {
    example: {
      claimReference: 'EXP-2026-0071',
      employeeName: 'Aarav Sharma',
      department: 'Engineering',
      category: 'Software',
      description: 'Annual monitoring subscription for the production service',
      amount: 12500,
    },
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
  entryNodeId: 'expense-check-limit',
  nodes: [
    {
      id: 'expense-check-limit',
      type: 'condition',
      name: 'Manager Approval Required?',
      config: { field: 'amount', operator: 'gt', value: 5000 },
      onTrue: 'expense-manager-approval',
      onFalse: 'expense-save-record',
      next: [],
    },
    {
      id: 'expense-manager-approval',
      type: 'approval',
      name: 'Manager Expense Approval',
      config: {
        message: 'Review the employee, department, category, description, and amount before approving this reimbursement.',
      },
      next: ['expense-save-record'],
    },
    {
      id: 'expense-save-record',
      type: 'expense_claim',
      name: 'Save Expense to Relay Ledger',
      config: {
        nodeId: 'expense-save-record',
        approvalNodeId: 'expense-manager-approval',
        autoApprovalLimit: 5000,
        fields: {
          claimReference: '{{claimReference}}',
          employeeName: '{{employeeName}}',
          department: '{{department}}',
          category: '{{category}}',
          description: '{{description}}',
          amount: '{{amount}}',
        },
      },
      next: ['expense-show-result'],
    },
    {
      id: 'expense-show-result',
      type: 'notify',
      name: 'Show Saved Reimbursement',
      config: {
        channel: 'console',
        message: 'Expense {{expenseClaim.claimReference}} saved as {{expenseClaim.status}}. Ledger record: {{expenseClaim.recordId}}.',
      },
      next: [],
    },
  ],
  publishedAt: new Date(),
};

const upsertBuiltinWorkflows = async () => {
  const Workflow = require('../src/models/Workflow');
  await Workflow.deleteOne({
    name: 'Approval-Gated Email Notification',
    userId: null,
    isTemplate: true,
  });

  const templates = [
    orderWorkflow,
    supportWorkflow,
    purchaseWorkflow,
    incidentWorkflow,
    githubWorkflow,
    expenseWorkflow,
  ].map((workflow) => ({
    ...workflow,
    isTemplate: true,
    publishedDefinition: {
      nodes: workflow.nodes,
      inputSchema: workflow.inputSchema,
      entryNodeId: workflow.entryNodeId,
      triggerType: workflow.triggerType,
    },
  }));

  await Workflow.bulkWrite(templates.map((workflow) => {
    const { webhookSecret, ...template } = workflow;
    return {
      updateOne: {
        filter: { name: template.name, userId: null },
        update: {
          $set: template,
          $setOnInsert: { webhookSecret: webhookSecret || uuidv4() },
        },
        upsert: true,
      },
    };
  }));

  return Workflow.find({
    name: { $in: templates.map((workflow) => workflow.name) },
    isTemplate: true,
  }).sort({ name: 1 });
};

const BUILTIN_WORKFLOW_NAMES = [
  'GitHub Repository Health Check',
  'Purchase Request Approval',
  'Production Incident Escalation',
  'E-Commerce Order Processing',
  'Support Ticket Router',
  'Employee Expense Reimbursement',
];

// ─── Seed Function ───────────────────────────────────────────────
const seed = async ({ exitProcess = false } = {}) => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('[Seed] MongoDB connected');

    const workflows = await upsertBuiltinWorkflows();

    console.log('[Seed] ✅ Ready-to-run shared workflows:');
    workflows.forEach((w) => {
      console.log(`  → ${w.name} (${w._id})`);
    });

    console.log('\n[Seed] Done! Templates are ready in the Workflows UI.');
    if (exitProcess) process.exit(0);
    return workflows;
  } catch (err) {
    console.error('[Seed] Error:', err.message);
    if (exitProcess) process.exit(1);
    throw err;
  }
};

if (require.main === module) {
  seed({ exitProcess: true });
}

module.exports = { upsertBuiltinWorkflows, BUILTIN_WORKFLOW_NAMES, seed };