const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const TaskChecklist = sequelize.define('TaskChecklist', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    task_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    updated_by: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    point: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('OK', 'ATTENTION', 'PENDING'),
        allowNull: false,
        defaultValue: 'PENDING'
    },
    initials: {
        type: DataTypes.STRING(10),
        allowNull: true
    },
    measured_value: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    bms_reading: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    remarks: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'task_checklist',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = TaskChecklist;
