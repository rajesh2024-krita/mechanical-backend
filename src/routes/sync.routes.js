const express = require('express');
const router = express.Router();
const { syncBatch } = require('../controllers/sync.controller');
const { protect } = require('../middleware/auth.middleware');

router.post('/', protect, syncBatch);

module.exports = router;
