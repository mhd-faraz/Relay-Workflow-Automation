const mongoose = require('mongoose');

const nodeSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: {
    type: String,
    required: true,
    enum: ['http_request', 'condition', 'delay', 'notify', 'ai', 'approval', 'expense_claim'],
  },
  name: { type: String, required: true },
  config: { type: mongoose.Schema.Types.Mixed, default: {} },
  next: { type: [String], default: [] },
  onTrue: { type: String, default: null },
  onFalse: { type: String, default: null },
}, { _id: false });

const workflowSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  isTemplate: { type: Boolean, default: false },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  status: {
    type: String,
    enum: ['draft', 'published'],
    default: 'draft',
  },
  triggerType: {
    type: String,
    enum: ['webhook', 'manual'],
    default: 'manual',
  },
  webhookSecret: { type: String, default: null },
  nodes: { type: [nodeSchema], default: [] },
  inputSchema: { type: mongoose.Schema.Types.Mixed, default: null },
  entryNodeId: { type: String, default: null },
  publishedAt: { type: Date, default: null },
  publishedDefinition: { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Workflow', workflowSchema);