const dotenv = require('dotenv');
const app = require('./app');
const { sequelize, testConnection } = require('./config/database');
const { seedEquipmentChecklistTemplates } = require('./utils/seedEquipmentChecklists');
const { DataTypes } = require('sequelize');

// Load env vars
dotenv.config();

const PORT = process.env.PORT || 5000;

const ensureLegacySchemaCompatibility = async () => {
    const queryInterface = sequelize.getQueryInterface();
    const buildingTable = await queryInterface.describeTable('buildings');

    if (!buildingTable.status) {
        console.log('Adding missing `buildings.status` column...');
        await queryInterface.addColumn('buildings', 'status', {
            type: DataTypes.ENUM('ACTIVE', 'INACTIVE'),
            allowNull: false,
            defaultValue: 'ACTIVE'
        });
    }
};

// Start server function
const startServer = async () => {
    try {
        // Test database connection
        const isConnected = await testConnection();
        
        if (!isConnected) {
            console.error('Failed to connect to database. Exiting...');
            process.exit(1);
        }

        await ensureLegacySchemaCompatibility();

        // Sync database (in development)
        if (process.env.NODE_ENV === 'development') {
            console.log('Syncing database models...');
            await sequelize.sync();
            await seedEquipmentChecklistTemplates();
            console.log('✅ Database synced');
        }

        const server = app.listen(PORT, () => {
            console.log(`✅ Server running on port ${PORT}`);
            console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
            console.log(`🔑 Test login: POST http://localhost:${PORT}/api/auth/login`);
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', (err, promise) => {
            console.error('❌ Unhandled Rejection:', err.message);
            server.close(() => process.exit(1));
        });

        // Handle uncaught exceptions
        process.on('uncaughtException', (err) => {
            console.error('❌ Uncaught Exception:', err.message);
            process.exit(1);
        });

    } catch (error) {
        console.error('❌ Error starting server:', error.message);
        process.exit(1);
    }
};

startServer();
