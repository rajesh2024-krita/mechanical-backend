const express = require('express');
const router = express.Router();
const { syncBatch, pushMutations, pullChanges } = require('../controllers/sync.controller');
const { protect } = require('../middleware/auth.middleware');
const { syncRateLimit } = require('../middleware/syncRateLimit.middleware');
const { syncRequestControl } = require('../middleware/syncRequestControl.middleware');

router.post('/', protect, syncBatch);
router.post('/push', protect, syncRateLimit, syncRequestControl, pushMutations);
router.get('/pull', protect, syncRateLimit, syncRequestControl, pullChanges);

module.exports = router;
