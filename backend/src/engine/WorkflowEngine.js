const { v4: uuidv4 } = require('uuid');
const Run = require('../models/Run');
const Step = require('../models/Step');
const Approval = require('../models/Approval');
const env = require('../config/env');
const {
  runHttpRequest,
  runCondition,
  runDelay,
  runNotify,
  runEmailNode,
  runAiNode,
  runApprovalNode,
} = require('./nodeRunners');

class WorkflowEngine {
  constructor(aiAdapter) {
    this.aiAdapter = aiAdapter;
  }

  async execute(runId) {
    const run = await Run.findById(runId);
    if (!run) throw new Error(`Run not found: ${runId}`);

    if (['completed', 'failed', 'cancelled'].includes(run.status)) return;

    const definition = run.definitionSnapshot;
    const nodes = this._buildNodeMap(definition.nodes);

    await Run.findByIdAndUpdate(runId, {
      status: 'running',
      startedAt: run.startedAt || new Date(),
    });

    let currentNodeId = run.currentNodeId || definition.entryNodeId;
    let context = { ...run.input };

    let stepCount = run.stepCount || 0;
    const maxSteps = run.maxSteps || env.MAX_STEPS_PER_RUN;

    while (currentNodeId) {
      if (stepCount >= maxSteps) {
        await this._failRun(runId, `Max step cap (${maxSteps}) reached. Possible infinite loop.`);
        return;
      }

      const node = nodes[currentNodeId];
      if (!node) {
        await this._failRun(runId, `Node not found: ${currentNodeId}`);
        return;
      }

      const existingStep = await Step.findOne({
        runId,
        nodeId: currentNodeId,
        status: 'completed',
      });

      if (existingStep) {
        context = { ...context, ...existingStep.output };
        currentNodeId = this._getNextNode(node, existingStep.output);
        stepCount++;
        continue;
      }

      const stepResult = await this._executeNode(run, node, context, stepCount);

      if (stepResult.paused) {
        await Run.findByIdAndUpdate(runId, {
          status: 'paused',
          currentNodeId,
          stepCount,
        });
        return;
      }

      if (stepResult.failed) {
        await this._failRun(runId, stepResult.error, currentNodeId, stepCount);
        return;
      }

      context = { ...context, ...stepResult.output };
      stepCount++;

      await Run.findByIdAndUpdate(runId, {
        currentNodeId,
        stepCount,
      });

      currentNodeId = this._getNextNode(node, stepResult.output);
    }

    await Run.findByIdAndUpdate(runId, {
      status: 'completed',
      completedAt: new Date(),
      output: context,
      stepCount,
    });

    console.log(`[Engine] Run ${runId} completed in ${stepCount} steps`);
  }

  async _executeNode(run, node, context, stepCount) {
    const runId = run._id;
    const idempotencyKey = `${runId}:${node.id}`;

    let step = await Step.findOne({ runId, nodeId: node.id });
    if (!step) {
      step = await Step.create({
        runId,
        nodeId: node.id,
        nodeType: node.type,
        nodeName: node.name,
        status: 'running',
        input: context,
        idempotencyKey,
        startedAt: new Date(),
      });
    }

    try {
      let output = {};

      switch (node.type) {
        case 'http_request':
          output = await runHttpRequest(node.config, context);
          break;

        case 'condition':
          output = await runCondition(node.config, context);
          break;

        case 'delay':
          output = await runDelay(node.config);
          break;

        case 'notify':
          output = await runNotify(node.config, context);
          break;

        case 'email':
          output = await runEmailNode(node.config, context);
          break;

        case 'ai':
          const aiResult = await runAiNode(node.config, context, this.aiAdapter);
          output = aiResult;
          await Step.findByIdAndUpdate(step._id, {
            tokenUsage: aiResult.tokenUsage || {},
          });
          break;

        case 'approval':
          await runApprovalNode(node.config, runId, node.id, node.name, context, Approval);
          break;

        default:
          throw new Error(`Unknown node type: ${node.type}`);
      }

      await Step.findByIdAndUpdate(step._id, {
        status: 'completed',
        output,
        attempts: step.attempts + 1,
        completedAt: new Date(),
      });

      return { output, failed: false, paused: false };

    } catch (err) {
      if (err.code === 'APPROVAL_PENDING') {
        await Step.findByIdAndUpdate(step._id, {
          status: 'pending',
          attempts: step.attempts + 1,
        });
        return { paused: true };
      }

      await Step.findByIdAndUpdate(step._id, {
        status: 'failed',
        error: err.message,
        attempts: step.attempts + 1,
        completedAt: new Date(),
      });

      return { failed: true, error: err.message };
    }
  }

  _buildNodeMap(nodes) {
    const map = {};
    for (const node of nodes) {
      map[node.id] = node;
    }
    return map;
  }

  _getNextNode(node, output) {
    if (node.type === 'condition') {
      return output?.result ? node.onTrue : node.onFalse;
    }
    return node.next?.[0] || null;
  }

  async _failRun(runId, reason, currentNodeId = null, stepCount = 0) {
    await Run.findByIdAndUpdate(runId, {
      status: 'failed',
      failureReason: reason,
      completedAt: new Date(),
      ...(currentNodeId && { currentNodeId }),
      ...(stepCount && { stepCount }),
    });
    console.error(`[Engine] Run ${runId} failed: ${reason}`);
  }
}

module.exports = WorkflowEngine;