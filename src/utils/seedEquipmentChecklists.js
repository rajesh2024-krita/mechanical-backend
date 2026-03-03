const { EquipmentChecklistTemplate } = require('../models');
const {
    EQUIPMENT_CHECKLISTS,
    CHECKLIST_ITEM_TYPES
} = require('../constants/equipment-checklists');

const seedEquipmentChecklistTemplates = async () => {
    const rows = [];

    Object.entries(EQUIPMENT_CHECKLISTS).forEach(([equipmentType, items]) => {
        items.forEach((itemText, index) => {
            rows.push({
                equipment_type: equipmentType.trim().toLowerCase(),
                item_text: itemText,
                item_type: CHECKLIST_ITEM_TYPES.CHECKLIST,
                sort_order: index + 1
            });
        });
    });

    if (!rows.length) {
        return 0;
    }

    await EquipmentChecklistTemplate.bulkCreate(rows, {
        ignoreDuplicates: true
    });

    return rows.length;
};

module.exports = {
    seedEquipmentChecklistTemplates
};
