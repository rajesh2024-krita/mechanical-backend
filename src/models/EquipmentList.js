const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const EquipmentList = sequelize.define('EquipmentList', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    equipment_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    asset_reference_number: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    equipment_classification: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    site_location: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    vertical_ref_floor: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    zone_context: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    additional_notes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    image: {
        type: DataTypes.STRING(255),
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
    tableName: 'equipment_list',
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

module.exports = EquipmentList;
