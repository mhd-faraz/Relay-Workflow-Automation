const express = require('express');
const router = express.Router();
const {
  createWorkflow,
  listWorkflows,
  getWorkflow,
  updateWorkflow,
  publishWorkflow,
  deleteWorkflow,
} = require('../controllers/workflow.controller');

router.post('/', createWorkflow);
router.get('/', listWorkflows);
router.get('/:id', getWorkflow);
router.put('/:id', updateWorkflow);
router.post('/:id/publish', publishWorkflow);
router.delete('/:id', deleteWorkflow);

module.exports = router;