const express = require('express');
const router = express.Router();
const {
  triggerRun,
  webhookTrigger,
  listRuns,
  getRun,
  getRunSteps,
} = require('../controllers/run.controller');

router.post('/workflows/:id/trigger', triggerRun);
router.post('/webhooks/:id', webhookTrigger);
router.get('/runs', listRuns);
router.get('/runs/:id', getRun);
router.get('/runs/:id/steps', getRunSteps);

module.exports = router;