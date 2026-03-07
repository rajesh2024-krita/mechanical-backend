const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Building = sequelize.define('Building', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        validate: {
            notEmpty: true
        }
    },
    location: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('ACTIVE', 'INACTIVE'),
        allowNull: false,
        defaultValue: 'ACTIVE'
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
    tableName: 'buildings',
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

module.exports = Building;
