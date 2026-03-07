const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Equipment = sequelize.define('Equipment', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    building_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('ACTIVE', 'INACTIVE', 'UNDER_MAINTENANCE'),
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
    tableName: 'equipment',
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

module.exports = Equipment;
