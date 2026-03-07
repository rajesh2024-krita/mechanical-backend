const crypto = require('crypto');

const DEBOUNCE_MS = Number(process.env.SYNC_DEBOUNCE_MS || 2000);
const DEDUPE_MS = Number(process.env.SYNC_DEDUPE_MS || 5000);
const MAX_IN_FLIGHT_SYNC = Number(process.env.SYNC_MAX_IN_FLIGHT || 200);
const BACKOFF_SECONDS = Number(process.env.SYNC_BACKOFF_SECONDS || 10);
const CACHE_TTL_MS = Number(process.env.SYNC_CACHE_TTL_MS || 120000);

const requestCache = new Map();
let inFlightSync = 0;

const stableStringify = (value) => {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
};

const computeRequestHash = (req) => {
    const source = req.method === 'GET' ? req.query : req.body;
    const payload = stableStringify(source || {});
    return crypto.createHash('sha256').update(`${req.method}:${req.path}:${payload}`).digest('hex');
};

const getClientKey = (req) => {
    const userId = req.user?.id || 'anonymous';
    const deviceId = String(req.headers['x-device-id'] || req.query.device_id || req.body?.device_id || 'unknown');
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    return `${userId}:${deviceId}:${ip}`;
};

const pruneCache = (now) => {
    for (const [key, value] of requestCache.entries()) {
        if ((now - value.updatedAt) > CACHE_TTL_MS) {
            requestCache.delete(key);
        }
    }
};

const syncRequestControl = (req, res, next) => {
    const now = Date.now();
    pruneCache(now);

    if (inFlightSync >= MAX_IN_FLIGHT_SYNC) {
        res.set('Retry-After', String(BACKOFF_SECONDS));
        return res.status(503).json({
            success: false,
            message: 'Sync is temporarily busy. Please retry.',
            retry_after_seconds: BACKOFF_SECONDS
        });
    }

    const clientKey = getClientKey(req);
    const requestHash = computeRequestHash(req);
    const cacheKey = `${clientKey}:${req.method}:${req.path}`;
    const cached = requestCache.get(cacheKey);

    if (cached?.inFlightPromise && cached.requestHash === requestHash) {
        return cached.inFlightPromise
            .then((resolved) => {
                res.set('X-Sync-Deduped', 'true');
                return res.status(resolved.statusCode || 200).json(resolved.body);
            })
            .catch(() => next());
    }

    if (cached?.responseBody && cached.requestHash === requestHash && (now - cached.responseAt) <= DEDUPE_MS) {
        res.set('X-Sync-Deduped', 'true');
        return res.status(cached.statusCode || 200).json(cached.responseBody);
    }

    if (cached?.responseBody && (now - cached.requestAt) <= DEBOUNCE_MS) {
        res.set('X-Sync-Debounced', 'true');
        return res.status(cached.statusCode || 200).json(cached.responseBody);
    }

    inFlightSync += 1;
    let inFlightResolve;
    let inFlightReject;
    const inFlightPromise = new Promise((resolve, reject) => {
        inFlightResolve = resolve;
        inFlightReject = reject;
    });
    requestCache.set(cacheKey, {
        requestHash,
        requestAt: now,
        updatedAt: now,
        inFlightPromise
    });

    const originalJson = res.json.bind(res);
    res.json = (body) => {
        requestCache.set(cacheKey, {
            requestHash,
            requestAt: now,
            responseAt: Date.now(),
            statusCode: res.statusCode,
            responseBody: body,
            updatedAt: Date.now()
        });
        if (inFlightResolve) {
            inFlightResolve({ statusCode: res.statusCode, body });
        }
        return originalJson(body);
    };

    let completed = false;
    const markComplete = () => {
        if (completed) return;
        completed = true;
        inFlightSync = Math.max(0, inFlightSync - 1);
        if (inFlightReject && !res.headersSent) {
            inFlightReject(new Error('Sync request ended before response body was sent'));
        }
    };

    res.on('finish', markComplete);
    res.on('close', markComplete);

    return next();
};

module.exports = { syncRequestControl };
