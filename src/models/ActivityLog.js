const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ActivityLog = sequelize.define('ActivityLog', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    action_type: {
        type: DataTypes.STRING(50),
        allowNull: false
    },
    entity_type: {
        type: DataTypes.STRING(50),
        allowNull: false
    },
    entity_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    version: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
    },
    deleted_at: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'activity_logs',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    hooks: {
        beforeUpdate: (row) => {
            if (!row.changed('version')) {
                row.setDataValue('version', (Number(row.getDataValue('version')) || 0) + 1);
            }
        }
    }
});

module.exports = ActivityLog;
