const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./config/swagger');

const errorHandler = require('./middleware/error.middleware');

// Import routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const buildingRoutes = require('./routes/building.routes');
const equipmentRoutes = require('./routes/equipment.routes');
const equipmentListRoutes = require('./routes/equipmentList.routes');
const taskRoutes = require('./routes/task.routes');
const activityRoutes = require('./routes/activity.routes');
const reportRoutes = require('./routes/report.routes');
const uploadRoutes = require('./routes/upload.routes');
const syncRoutes = require('./routes/sync.routes');

const app = express();

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Respect X-Forwarded-* headers when deployed behind a reverse proxy/load balancer.
if (process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
}

// Set security headers
app.use(helmet());

// Enable CORS
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true
}));

// Rate limiting (kept off in development by default to avoid blocking local frontend calls)
const isProduction = process.env.NODE_ENV === 'production';
const rateLimitEnabled = process.env.RATE_LIMIT_ENABLED
    ? process.env.RATE_LIMIT_ENABLED === 'true'
    : isProduction;

if (rateLimitEnabled) {
    const limiter = rateLimit({
        windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 10 * 60 * 1000, // 10 minutes
        max: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 500,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
            success: false,
            message: 'Too many requests, please try again later.'
        }
    });
    app.use('/api', limiter);
}

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Documentation - Make sure this is before routes
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Maintenance Management API',
    swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true
    }
}));

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/buildings', buildingRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/equipment-list', equipmentListRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/sync', syncRoutes);

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', message: 'Server is running' });
});

// Error handler
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

module.exports = app;
