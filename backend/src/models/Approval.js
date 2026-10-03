const mongoose = require('mongoose');

const approvalSchema = new mongoose.Schema({
  runId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Run',
    required: true,
  },
  nodeId: { type: String, required: true },
  nodeName: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  requestedAt: { type: Date, default: Date.now },
  resolvedAt: { type: Date, default: null },
  resolvedBy: { type: String, default: null },
  comment: { type: String, default: null },
  context: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

approvalSchema.index({ runId: 1, nodeId: 1 });
approvalSchema.index({ status: 1 });

module.exports = mongoose.model('Approval', approvalSchema);