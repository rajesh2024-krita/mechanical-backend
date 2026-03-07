const rateLimit = require('express-rate-limit');

const SYNC_WINDOW_MS = Number(process.env.SYNC_RATE_LIMIT_WINDOW_MS || 60 * 1000);
const SYNC_MAX_REQUESTS = Number(process.env.SYNC_RATE_LIMIT_MAX || 40);

const syncRateLimit = rateLimit({
    windowMs: SYNC_WINDOW_MS,
    max: SYNC_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        const userId = req.user?.id || 'anonymous';
        const deviceId = String(req.headers['x-device-id'] || req.query.device_id || req.body?.device_id || 'unknown');
        const ip = req.ip || req.connection?.remoteAddress || 'unknown';
        return `${userId}:${deviceId}:${ip}`;
    },
    handler: (req, res) => {
        const retryAfterSeconds = Math.ceil(SYNC_WINDOW_MS / 1000);
        res.set('Retry-After', String(retryAfterSeconds));
        return res.status(429).json({
            success: false,
            message: 'Too many sync requests. Please retry later.',
            retry_after_seconds: retryAfterSeconds
        });
    }
});

module.exports = { syncRateLimit };
