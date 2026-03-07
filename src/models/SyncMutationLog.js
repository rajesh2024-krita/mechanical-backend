const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SyncMutationLog = sequelize.define('SyncMutationLog', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    mutation_id: {
        type: DataTypes.STRING(191),
        allowNull: false,
        unique: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    device_id: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    entity: {
        type: DataTypes.STRING(50),
        allowNull: false
    },
    entity_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    operation: {
        type: DataTypes.STRING(20),
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('success', 'conflict', 'failed'),
        allowNull: false
    },
    result_payload: {
        type: DataTypes.JSON,
        allowNull: true
    },
    processed_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'sync_mutation_logs',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

module.exports = SyncMutationLog;
