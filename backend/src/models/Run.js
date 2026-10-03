const mongoose = require('mongoose');

const runSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  workflowId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workflow',
    required: true,
  },
  definitionSnapshot: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'running', 'paused', 'completed', 'failed', 'cancelled'],
    default: 'pending',
  },
  triggerType: {
    type: String,
    enum: ['webhook', 'manual'],
    default: 'manual',
  },
  input: { type: mongoose.Schema.Types.Mixed, default: {} },
  output: { type: mongoose.Schema.Types.Mixed, default: null },
  currentNodeId: { type: String, default: null },
  stepCount: { type: Number, default: 0 },
  maxSteps: { type: Number, default: 100 },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  failureReason: { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Run', runSchema);