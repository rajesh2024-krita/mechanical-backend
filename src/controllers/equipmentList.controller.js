const { EquipmentList, Equipment, User } = require('../models');
const { logActivity } = require('../services/activity.service');

const canAccessEquipment = (req, equipment) => {
    if (req.user.role === 'SUPER_ADMIN') {
        return true;
    }
    return equipment.building_id === req.user.building_id;
};

const canAccessEntry = (req, entry) => {
    if (req.user.role === 'SUPER_ADMIN') {
        return true;
    }
    const entryBuildingId = entry.equipment?.building_id;
    if (entryBuildingId) {
        return entryBuildingId === req.user.building_id;
    }
    return false;
};

const getEquipmentList = async (req, res, next) => {
    try {
        const where = {};
        const equipmentWhere = {};

        if (req.query.equipment_id) {
            where.equipment_id = parseInt(req.query.equipment_id, 10);
        }
        if (req.query.user_id) {
            where.user_id = parseInt(req.query.user_id, 10);
        }
        if (req.query.building_id) {
            const requestedBuildingId = parseInt(req.query.building_id, 10);
            if (req.user.role !== 'SUPER_ADMIN' && req.user.building_id !== requestedBuildingId) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to view equipment list for this building'
                });
            }
            equipmentWhere.building_id = requestedBuildingId;
        } else if (req.user.role !== 'SUPER_ADMIN') {
            equipmentWhere.building_id = req.user.building_id;
        }

        const entries = await EquipmentList.findAll({
            where,
            include: [
                {
                    model: Equipment,
                    as: 'equipment',
                    where: equipmentWhere,
                    required: true,
                    attributes: ['id', 'building_id', 'name', 'status']
                },
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'name', 'email', 'role']
                }
            ],
            order: [['created_at', 'DESC']]
        });

        res.status(200).json({
            success: true,
            count: entries.length,
            equipmentList: entries
        });
    } catch (error) {
        next(error);
    }
};

const getEquipmentListById = async (req, res, next) => {
    try {
        const entry = await EquipmentList.findByPk(req.params.id, {
            include: [
                {
                    model: Equipment,
                    as: 'equipment',
                    attributes: ['id', 'building_id', 'name']
                },
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'name', 'email', 'role']
                }
            ]
        });

        if (!entry) {
            return res.status(404).json({
                success: false,
                message: 'Equipment list entry not found'
            });
        }

        if (!canAccessEntry(req, entry)) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view this entry'
            });
        }

        res.status(200).json({
            success: true,
            equipmentList: entry
        });
    } catch (error) {
        next(error);
    }
};

const createEquipmentListEntry = async (req, res, next) => {
    try {
        const {
            equipment_id,
            user_id,
            asset_reference_number,
            equipment_classification,
            site_location,
            vertical_ref_floor,
            zone_context,
            additional_notes,
            image
        } = req.body;

        const equipment = await Equipment.findByPk(equipment_id);
        if (!equipment) {
            return res.status(404).json({
                success: false,
                message: 'Equipment not found'
            });
        }

        if (!canAccessEquipment(req, equipment)) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to create entry for this equipment'
            });
        }

        const resolvedUserId = req.user.role === 'SUPER_ADMIN' && user_id ? user_id : req.user.id;

        const entry = await EquipmentList.create({
            equipment_id,
            user_id: resolvedUserId,
            asset_reference_number,
            equipment_classification,
            site_location,
            vertical_ref_floor,
            zone_context,
            additional_notes,
            image
        });

        await logActivity(req.user.id, 'CREATE', 'EQUIPMENT_LIST', entry.id, `Created equipment list entry for equipment ${equipment_id}`);

        res.status(201).json({
            success: true,
            equipmentList: entry
        });
    } catch (error) {
        next(error);
    }
};

const updateEquipmentListEntry = async (req, res, next) => {
    try {
        const entry = await EquipmentList.findByPk(req.params.id, {
            include: [{ model: Equipment, as: 'equipment', attributes: ['id', 'building_id', 'name'] }]
        });

        if (!entry) {
            return res.status(404).json({
                success: false,
                message: 'Equipment list entry not found'
            });
        }

        if (!canAccessEntry(req, entry)) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this entry'
            });
        }

        const updates = { ...req.body };
        delete updates.id;
        delete updates.created_at;
        delete updates.updated_at;
        // Keep ownership tied to creator for non-super-admin users.
        if (req.user.role !== 'SUPER_ADMIN') {
            updates.user_id = req.user.id;
        }

        if (updates.equipment_id) {
            const equipment = await Equipment.findByPk(updates.equipment_id);
            if (!equipment) {
                return res.status(404).json({
                    success: false,
                    message: 'New equipment_id is invalid'
                });
            }
            if (!canAccessEquipment(req, equipment)) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to move entry to this equipment'
                });
            }
        }

        await entry.update(updates);

        await logActivity(req.user.id, 'UPDATE', 'EQUIPMENT_LIST', entry.id, `Updated equipment list entry ${entry.id}`);

        res.status(200).json({
            success: true,
            equipmentList: entry
        });
    } catch (error) {
        next(error);
    }
};

const deleteEquipmentListEntry = async (req, res, next) => {
    try {
        const entry = await EquipmentList.findByPk(req.params.id, {
            include: [{ model: Equipment, as: 'equipment', attributes: ['id', 'building_id', 'name'] }]
        });

        if (!entry) {
            return res.status(404).json({
                success: false,
                message: 'Equipment list entry not found'
            });
        }

        if (!canAccessEntry(req, entry)) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to delete this entry'
            });
        }

        await logActivity(req.user.id, 'DELETE', 'EQUIPMENT_LIST', entry.id, `Deleted equipment list entry ${entry.id}`);
        await entry.destroy();

        res.status(200).json({
            success: true,
            message: 'Equipment list entry deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getEquipmentList,
    getEquipmentListById,
    createEquipmentListEntry,
    updateEquipmentListEntry,
    deleteEquipmentListEntry
};
