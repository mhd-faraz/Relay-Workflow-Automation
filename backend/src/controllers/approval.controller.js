const Approval = require('../models/Approval');
const Run = require('../models/Run');
const { getQueue } = require('../workers/workflowWorker');

// GET /api/approvals?status=pending
const listApprovals = async (req, res) => {
  try {
    const { status } = req.query;

    // Find runs belonging to this user first
    const userRuns = await Run.find({ userId: req.userId }).select('_id');
    const runIds = userRuns.map((r) => r._id);

    const filter = { runId: { $in: runIds } };
    if (status) filter.status = status;

    const approvals = await Approval.find(filter)
      .sort({ createdAt: -1 })
      .populate('runId', 'status workflowId');

    res.json({ success: true, data: approvals });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/approvals/:id/resolve
const resolveApproval = async (req, res) => {
  try {
    const { action, resolvedBy, comment } = req.body;

    if (!['approved', 'rejected'].includes(action)) {
      return res.status(400).json({ success: false, error: 'action must be approved or rejected' });
    }

    const approval = await Approval.findById(req.params.id).populate('runId');
    if (!approval) return res.status(404).json({ success: false, error: 'Approval not found' });

    // Verify this approval belongs to the current user's run
    if (!approval.runId || String(approval.runId.userId) !== String(req.userId)) {
      return res.status(403).json({ success: false, error: 'Not authorized to resolve this approval' });
    }

    if (approval.status !== 'pending') {
      return res.status(400).json({ success: false, error: 'Approval already resolved' });
    }

    approval.status = action;
    approval.resolvedAt = new Date();
    approval.resolvedBy = resolvedBy || 'human';
    approval.comment = comment || null;
    await approval.save();

    if (action === 'approved') {
      await Run.findByIdAndUpdate(approval.runId._id, { status: 'pending' });

      const queue = getQueue();
      await queue.add(
        'run-workflow',
        { runId: approval.runId._id.toString() },
        { jobId: `resume-${approval.runId._id}-${Date.now()}` }
      );

      res.json({ success: true, message: 'Approved and run resumed', data: approval });
    } else {
      await Run.findByIdAndUpdate(approval.runId._id, {
        status: 'failed',
        failureReason: `Rejected at approval node: ${approval.nodeName}`,
        completedAt: new Date(),
      });

      res.json({ success: true, message: 'Rejected and run failed', data: approval });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = { listApprovals, resolveApproval };