const mongoose = require('mongoose');

const expenseClaimSchema = new mongoose.Schema({
  runId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Run',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  nodeId: { type: String, required: true },
  claimReference: { type: String, required: true, trim: true },
  employeeName: { type: String, required: true, trim: true },
  department: { type: String, required: true, trim: true },
  category: {
    type: String,
    enum: ['Travel', 'Meals', 'Software', 'Equipment', 'Other'],
    required: true,
  },
  description: { type: String, required: true, trim: true, maxlength: 1000 },
  amount: { type: Number, required: true, min: 0.01 },
  currency: { type: String, enum: ['INR'], default: 'INR' },
  status: { type: String, enum: ['auto_approved', 'approved'], required: true },
  approvedBy: { type: String, default: null },
  approvedAt: { type: Date, default: null },
}, { timestamps: true });

expenseClaimSchema.index({ runId: 1, nodeId: 1 }, { unique: true });
expenseClaimSchema.index({ userId: 1, claimReference: 1 }, { unique: true });
expenseClaimSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('ExpenseClaim', expenseClaimSchema);
