const express = require('express');
const router = express.Router();
const { listApprovals, resolveApproval } = require('../controllers/approval.controller');

router.get('/', listApprovals);
router.post('/:id/resolve', resolveApproval);

module.exports = router;