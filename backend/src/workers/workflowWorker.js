const { Worker, Queue } = require('bullmq');
const { getRedisClient } = require('../config/redis');
const { connectDB } = require('../config/db');
const WorkflowEngine = require('../engine/WorkflowEngine');
const { getAiAdapter } = require('../adapters/aiAdapter');

const QUEUE_NAME = 'workflow-runs';

let worker = null;
let queue = null;

const getQueue = () => {
  if (queue) return queue;
  queue = new Queue(QUEUE_NAME, {
    connection: getRedisClient(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 200,
    },
  });
  return queue;
};

const startWorker = async () => {
  await connectDB();

  const aiAdapter = getAiAdapter();
  const engine = new WorkflowEngine(aiAdapter);

  worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { runId } = job.data;
      console.log(`[Worker] Processing run: ${runId}`);
      await engine.execute(runId);
      console.log(`[Worker] Done: ${runId}`);
    },
    {
      connection: getRedisClient(),
      concurrency: 5,
    }
  );

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('[Worker] Error:', err.message);
  });

  console.log('[Worker] Started — listening for jobs...');
};

const stopWorker = async () => {
  if (worker) {
    await worker.close();
    worker = null;
    console.log('[Worker] Stopped');
  }
};

module.exports = { startWorker, stopWorker, getQueue };