const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const EquipmentChecklistTemplate = sequelize.define('EquipmentChecklistTemplate', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    equipment_type: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    item_text: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    item_type: {
        type: DataTypes.ENUM('CHECKLIST', 'ADDON'),
        allowNull: false,
        defaultValue: 'CHECKLIST'
    },
    sort_order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
    }
}, {
    tableName: 'equipment_checklist_templates',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        {
            unique: true,
            fields: [
                'equipment_type',
                {
                    name: 'item_text',
                    length: 191
                },
                'item_type'
            ]
        },
        {
            fields: ['equipment_type', 'sort_order']
        }
    ]
});

module.exports = EquipmentChecklistTemplate;
