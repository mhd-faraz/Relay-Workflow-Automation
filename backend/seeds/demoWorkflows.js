require('dotenv').config();
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/relay-capstone';

// ─── Demo Workflow 1: E-Commerce Order Processing ────────────────
const orderWorkflow = {
  name: 'E-Commerce Order Processing',
  description: 'Generic order workflow — classify order, notify team, wait for approval, process payment',
  status: 'published',
  triggerType: 'webhook',
  webhookSecret: uuidv4(),
  entryNodeId: 'node-classify',
  nodes: [
    {
      id: 'node-classify',
      type: 'ai',
      name: 'Classify Order',
      config: {
        prompt: `You are an order classification engine. Analyze this order and respond with JSON only:
Order data: {{payload}}
Respond with: { "orderType": "standard|express|bulk", "priority": "low|medium|high", "requiresApproval": true|false, "reason": "string" }`,
        outputSchema: {
          orderType: { type: 'string', required: true },
          priority: { type: 'string', required: true },
          requiresApproval: { type: 'boolean', required: true },
        },
      },
      next: ['node-check-approval'],
    },
    {
      id: 'node-check-approval',
      type: 'condition',
      name: 'Needs Approval?',
      config: {
        field: 'parsed.requiresApproval',
        operator: 'eq',
        value: true,
      },
      onTrue: 'node-approval-gate',
      onFalse: 'node-notify-team',
    },
    {
      id: 'node-approval-gate',
      type: 'approval',
      name: 'Manager Approval',
      config: {
        message: 'High value order requires manager approval',
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
        url: 'https://httpbin.org/post',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { orderId: '{{payload.orderId}}', amount: '{{payload.amount}}' },
      },
      next: ['node-complete'],
    },
    {
      id: 'node-complete',
      type: 'notify',
      name: 'Order Complete',
      config: {
        channel: 'console',
        message: 'Order {{payload.orderId}} processed successfully!',
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

// ─── Seed Function ───────────────────────────────────────────────
const seed = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('[Seed] MongoDB connected');

   const Workflow = require('../src/models/Workflow');

    // Clear existing seeded workflows
    await Workflow.deleteMany({ name: { $in: [
      'E-Commerce Order Processing',
      'Support Ticket Router',
      'Content Moderation Pipeline',
    ]}});

    const workflows = await Workflow.insertMany([
      orderWorkflow,
      supportWorkflow,
      moderationWorkflow,
    ]);

    console.log('[Seed] ✅ Created workflows:');
    workflows.forEach((w) => {
      console.log(`  → ${w.name} (${w._id}) | Secret: ${w.webhookSecret}`);
    });

    console.log('\n[Seed] Done! Use these IDs to trigger runs.');
    process.exit(0);
  } catch (err) {
    console.error('[Seed] Error:', err.message);
    process.exit(1);
  }
};

seed();