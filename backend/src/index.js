const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const { connectDB } = require('./config/db');
const { getRedisClient } = require('./config/redis');
const env = require('./config/env');
const errorHandler = require('./middleware/errorHandler');
const rateLimiter = require('./middleware/rateLimiter');
const authMiddleware = require('./middleware/auth');

const authRoutes = require('./routes/auth.routes');
const workflowRoutes = require('./routes/workflow.routes');
const approvalRoutes = require('./routes/approval.routes');
const { triggerRun, webhookTrigger, listRuns, getRun, getRunSteps } = require('./controllers/run.controller');

const app = express();

// ─── Middleware ──────────────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(rateLimiter(100, 60000));

// ─── Health Check (public) ───────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Auth Routes (public) ────────────────────────────────────────
app.use('/api/auth', authRoutes);

// ─── Webhook Trigger (public — protected by webhook secret instead) ──
app.post('/api/webhooks/:id', webhookTrigger);

// ─── Protected Routes (require login) ────────────────────────────
app.use('/api/workflows', authMiddleware, workflowRoutes);
app.use('/api/approvals', authMiddleware, approvalRoutes);

app.post('/api/workflows/:id/trigger', authMiddleware, triggerRun);
app.get('/api/runs', authMiddleware, listRuns);
app.get('/api/runs/:id', authMiddleware, getRun);
app.get('/api/runs/:id/steps', authMiddleware, getRunSteps);

// ─── 404 Handler ─────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// ─── Global Error Handler ────────────────────────────────────────
app.use(errorHandler);

// ─── Start Server ────────────────────────────────────────────────
const start = async () => {
  try {
    await connectDB();

    const redis = getRedisClient();
    await redis.connect();

    const { startWorker } = require('./workers/workflowWorker');
    await startWorker();

    app.listen(env.PORT, () => {
      console.log(`[Server] Relay running on http://localhost:${env.PORT}`);
      console.log(`[Server] Environment: ${env.NODE_ENV}`);
    });
  } catch (err) {
    console.error('[Server] Failed to start:', err.message);
    process.exit(1);
  }
};

process.on('SIGTERM', async () => {
  console.log('[Server] Shutting down...');
  const { stopWorker } = require('./workers/workflowWorker');
  await stopWorker();
  process.exit(0);
});

start();

module.exports = app;