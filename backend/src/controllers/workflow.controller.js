const Workflow = require('../models/Workflow');
const { v4: uuidv4 } = require('uuid');

// POST /api/workflows
const createWorkflow = async (req, res) => {
  try {
    const { name, description, triggerType, nodes, entryNodeId } = req.body;

    const workflow = await Workflow.create({
      userId: req.userId,
      isTemplate: false,
      name,
      description,
      triggerType: triggerType || 'manual',
      nodes: nodes || [],
      entryNodeId: entryNodeId || null,
    });

    res.status(201).json({ success: true, data: workflow });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// GET /api/workflows — returns user's own workflows + shared templates
const listWorkflows = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {
      $or: [
        { userId: req.userId },
        { isTemplate: true },
      ],
    };
    if (status) filter.status = status;

    const workflows = await Workflow.find(filter).sort({ isTemplate: -1, createdAt: -1 });
    res.json({ success: true, data: workflows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/workflows/:id — accessible if owned OR is a template
const getWorkflow = async (req, res) => {
  try {
    const workflow = await Workflow.findOne({
      _id: req.params.id,
      $or: [{ userId: req.userId }, { isTemplate: true }],
    });
    if (!workflow) return res.status(404).json({ success: false, error: 'Workflow not found' });
    res.json({ success: true, data: workflow });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// PUT /api/workflows/:id — owner only
const updateWorkflow = async (req, res) => {
  try {
    const workflow = await Workflow.findOne({ _id: req.params.id, userId: req.userId });
    if (!workflow) return res.status(404).json({ success: false, error: 'Workflow not found or not editable' });

    if (workflow.status === 'published') {
      return res.status(400).json({ success: false, error: 'Cannot edit a published workflow' });
    }

    const allowed = ['name', 'description', 'triggerType', 'nodes', 'entryNodeId'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) workflow[key] = req.body[key];
    }

    await workflow.save();
    res.json({ success: true, data: workflow });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// POST /api/workflows/:id/publish — owner only
const publishWorkflow = async (req, res) => {
  try {
    const workflow = await Workflow.findOne({ _id: req.params.id, userId: req.userId });
    if (!workflow) return res.status(404).json({ success: false, error: 'Workflow not found or not editable' });

    if (workflow.status === 'published') {
      return res.status(400).json({ success: false, error: 'Workflow already published' });
    }

    if (!workflow.nodes || workflow.nodes.length === 0) {
      return res.status(400).json({ success: false, error: 'Workflow must have at least one node' });
    }

    if (!workflow.entryNodeId) {
      return res.status(400).json({ success: false, error: 'Workflow must have an entryNodeId' });
    }

    const nodeIds = workflow.nodes.map((n) => n.id);
    if (!nodeIds.includes(workflow.entryNodeId)) {
      return res.status(400).json({ success: false, error: 'entryNodeId does not match any node' });
    }

    workflow.status = 'published';
    workflow.publishedAt = new Date();
    workflow.webhookSecret = workflow.webhookSecret || uuidv4();
    workflow.publishedDefinition = {
      nodes: workflow.nodes,
      entryNodeId: workflow.entryNodeId,
      triggerType: workflow.triggerType,
    };

    await workflow.save();
    res.json({ success: true, data: workflow });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// DELETE /api/workflows/:id — owner only
const deleteWorkflow = async (req, res) => {
  try {
    const workflow = await Workflow.findOne({ _id: req.params.id, userId: req.userId });
    if (!workflow) return res.status(404).json({ success: false, error: 'Workflow not found or not deletable' });

    if (workflow.status === 'published') {
      return res.status(400).json({ success: false, error: 'Cannot delete a published workflow' });
    }

    await workflow.deleteOne();
    res.json({ success: true, message: 'Workflow deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = {
  createWorkflow,
  listWorkflows,
  getWorkflow,
  updateWorkflow,
  publishWorkflow,
  deleteWorkflow,
};