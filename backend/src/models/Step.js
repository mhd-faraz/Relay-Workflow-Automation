const mongoose = require('mongoose');

const stepSchema = new mongoose.Schema({
  runId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Run',
    required: true,
  },
  nodeId: { type: String, required: true },
  nodeType: { type: String, required: true },
  nodeName: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'running', 'completed', 'failed', 'skipped'],
    default: 'pending',
  },
  input: { type: mongoose.Schema.Types.Mixed, default: {} },
  output: { type: mongoose.Schema.Types.Mixed, default: null },
  error: { type: String, default: null },
  attempts: { type: Number, default: 0 },
  idempotencyKey: { type: String, default: null },
  tokenUsage: {
    promptTokens: { type: Number, default: 0 },
    completionTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
  },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
}, { timestamps: true });

stepSchema.index({ runId: 1, nodeId: 1 });
stepSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Step', stepSchema);