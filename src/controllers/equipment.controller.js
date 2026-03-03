const { Op } = require('sequelize');
const {
    Equipment,
    EquipmentList,
    Building,
    Task,
    User,
    EquipmentChecklistTemplate
} = require('../models');
const { logActivity } = require('../services/activity.service');
const {
    CHECKLIST_ITEM_TYPES,
    EQUIPMENT_TYPE_OPTIONS
} = require('../constants/equipment-checklists');

/**
 * @swagger
 * tags:
 *   name: Equipment
 *   description: Equipment management endpoints
 */

const normalizeEquipmentType = (value = '') => value.trim().toLowerCase();
const ALLOWED_EQUIPMENT_TYPE_KEYS = new Set(EQUIPMENT_TYPE_OPTIONS.map((item) => item.key));

const splitChecklistAndAddons = (rows) => {
    const checklist = [];
    const addons = [];

    rows.forEach((row) => {
        if (row.item_type === CHECKLIST_ITEM_TYPES.ADDON) {
            addons.push(row.item_text);
            return;
        }
        checklist.push(row.item_text);
    });

    return { checklist, addons };
};

const getEquipmentTypes = async (req, res, next) => {
    try {
        const where = {};
        if (req.user.role !== 'SUPER_ADMIN') {
            where.building_id = req.user.building_id;
        }

        const rows = await Equipment.findAll({
            where,
            attributes: ['name'],
            order: [['name', 'ASC']]
        });

        // Build unique type list from equipment names stored in DB.
        const seen = new Set();
        const equipmentTypes = rows
            .map((row) => (row.name || '').trim())
            .filter(Boolean)
            .map((name) => {
                const key = normalizeEquipmentType(name);
                if (!key || seen.has(key)) return null;
                seen.add(key);
                return { key, label: name };
            })
            .filter(Boolean);

        res.status(200).json({
            success: true,
            count: equipmentTypes.length,
            equipmentTypes
        });
    } catch (error) {
        next(error);
    }
};

const getChecklistByType = async (req, res, next) => {
    try {
        const equipmentType = normalizeEquipmentType(req.params.equipmentType || '');

        if (!equipmentType) {
            return res.status(400).json({
                success: false,
                message: 'equipmentType is required'
            });
        }
        if (!ALLOWED_EQUIPMENT_TYPE_KEYS.has(equipmentType)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid equipment type'
            });
        }

        const rows = await EquipmentChecklistTemplate.findAll({
            where: { equipment_type: equipmentType },
            order: [['sort_order', 'ASC'], ['id', 'ASC']]
        });

        if (!rows.length) {
            return res.status(404).json({
                success: false,
                message: `No checklist template found for equipment type: ${equipmentType}`
            });
        }

        const { checklist, addons } = splitChecklistAndAddons(rows);

        res.status(200).json({
            success: true,
            equipmentType,
            checklist,
            addons
        });
    } catch (error) {
        next(error);
    }
};

const getChecklistByEquipmentId = async (req, res, next) => {
    try {
        const equipment = await Equipment.findByPk(req.params.id);

        if (!equipment) {
            return res.status(404).json({
                success: false,
                message: 'Equipment not found'
            });
        }

        if (req.user.role !== 'SUPER_ADMIN' && equipment.building_id !== req.user.building_id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view this equipment'
            });
        }

        const equipmentListRow = await EquipmentList.findOne({
            where: { equipment_id: equipment.id },
            order: [['updated_at', 'DESC'], ['id', 'DESC']]
        });

        const resolvedType = normalizeEquipmentType(
            equipmentListRow?.equipment_classification || equipment.name || ''
        );

        const rows = await EquipmentChecklistTemplate.findAll({
            where: { equipment_type: resolvedType },
            order: [['sort_order', 'ASC'], ['id', 'ASC']]
        });

        const { checklist, addons } = splitChecklistAndAddons(rows);

        res.status(200).json({
            success: true,
            equipmentId: equipment.id,
            equipmentType: resolvedType,
            checklist,
            addons
        });
    } catch (error) {
        next(error);
    }
};

const createAddonChecklistItem = async (req, res, next) => {
    try {
        const equipmentType = normalizeEquipmentType(req.params.equipmentType || '');
        const itemText = (req.body.item_text || '').trim();

        if (!equipmentType) {
            return res.status(400).json({
                success: false,
                message: 'equipmentType is required'
            });
        }
        if (!ALLOWED_EQUIPMENT_TYPE_KEYS.has(equipmentType)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid equipment type'
            });
        }

        if (!itemText) {
            return res.status(400).json({
                success: false,
                message: 'item_text is required'
            });
        }

        const maxOrder = await EquipmentChecklistTemplate.max('sort_order', {
            where: {
                equipment_type: equipmentType,
                item_type: {
                    [Op.in]: [CHECKLIST_ITEM_TYPES.CHECKLIST, CHECKLIST_ITEM_TYPES.ADDON]
                }
            }
        });
        const parsedMaxOrder = Number(maxOrder);

        const addon = await EquipmentChecklistTemplate.create({
            equipment_type: equipmentType,
            item_text: itemText,
            item_type: CHECKLIST_ITEM_TYPES.ADDON,
            sort_order: Number.isFinite(parsedMaxOrder) ? parsedMaxOrder + 1 : 1
        });

        await logActivity(
            req.user.id,
            'CREATE',
            'EQUIPMENT_CHECKLIST_TEMPLATE',
            addon.id,
            `Added addon checklist item for ${equipmentType}`
        );

        res.status(201).json({
            success: true,
            addon
        });
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({
                success: false,
                message: 'This checklist item already exists for the selected equipment type'
            });
        }
        next(error);
    }
};

/**
 * @swagger
 * components:
 *   schemas:
 *     Equipment:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         building_id:
 *           type: integer
 *           example: 1
 *         name:
 *           type: string
 *           example: HVAC System
 *         category:
 *           type: string
 *           example: Climate Control
 *         equipment_type:
 *           type: string
 *           example: chiller
 *         serial_number:
 *           type: string
 *           example: HVAC001
 *         installation_date:
 *           type: string
 *           format: date
 *           example: 2023-01-15
 *         status:
 *           type: string
 *           enum: [ACTIVE, INACTIVE, UNDER_MAINTENANCE]
 *           example: ACTIVE
 *         photo_url:
 *           type: string
 *           example: /uploads/equipment-123.jpg
 */

/**
 * @swagger
 * /equipment:
 *   get:
 *     summary: Get all equipment
 *     tags: [Equipment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: building_id
 *         schema:
 *           type: integer
 *         description: Filter by building
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, INACTIVE, UNDER_MAINTENANCE]
 *         description: Filter by status
 *     responses:
 *       200:
 *         description: List of equipment
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                 equipment:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Equipment'
 */
const getEquipment = async (req, res, next) => {
    try {
        const where = {};
        
        if (req.query.building_id) {
            if (req.user.role === 'SUPER_ADMIN' || req.user.building_id === parseInt(req.query.building_id)) {
                where.building_id = req.query.building_id;
            } else {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to view equipment from this building'
                });
            }
        } else if (req.user.role !== 'SUPER_ADMIN') {
            where.building_id = req.user.building_id;
        }
        if (req.query.status) {
            where.status = req.query.status;
        }

        const equipment = await Equipment.findAll({
            where,
            include: [
                {
                    model: Building,
                    as: 'building',
                    attributes: ['id', 'name']
                }
            ],
            order: [['created_at', 'DESC']]
        });

        res.status(200).json({
            success: true,
            count: equipment.length,
            equipment
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @swagger
 * /equipment/{id}:
 *   get:
 *     summary: Get equipment by ID
 *     tags: [Equipment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Equipment details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 equipment:
 *                   $ref: '#/components/schemas/Equipment'
 */
const getEquipmentById = async (req, res, next) => {
    try {
        const equipment = await Equipment.findByPk(req.params.id, {
            include: [
                {
                    model: Building,
                    as: 'building',
                    attributes: ['id', 'name']
                },
                {
                    model: Task,
                    as: 'tasks',
                    include: [
                        {
                            model: User,
                            as: 'assignee',
                            attributes: ['id', 'name']
                        }
                    ]
                }
            ]
        });

        if (!equipment) {
            return res.status(404).json({
                success: false,
                message: 'Equipment not found'
            });
        }

        if (req.user.role !== 'SUPER_ADMIN' && equipment.building_id !== req.user.building_id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view this equipment'
            });
        }

        res.status(200).json({
            success: true,
            equipment
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @swagger
 * /equipment:
 *   post:
 *     summary: Create new equipment
 *     tags: [Equipment]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - building_id
 *               - name
 *             properties:
 *               building_id:
 *                 type: integer
 *                 example: 1
 *               name:
 *                 type: string
 *                 example: New HVAC System
 *               category:
 *                 type: string
 *                 example: Climate Control
 *               equipment_type:
 *                 type: string
 *                 example: chiller
 *               serial_number:
 *                 type: string
 *                 example: HVAC002
 *               installation_date:
 *                 type: string
 *                 format: date
 *                 example: 2024-01-01
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, INACTIVE, UNDER_MAINTENANCE]
 *                 default: ACTIVE
 *     responses:
 *       201:
 *         description: Equipment created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 equipment:
 *                   $ref: '#/components/schemas/Equipment'
 */
const createEquipment = async (req, res, next) => {
    try {
        const {
            building_id,
            name,
            status
        } = req.body;

        if (req.user.role !== 'SUPER_ADMIN' && building_id !== req.user.building_id) {
            return res.status(403).json({
                success: false,
                message: 'You can only add equipment to your building'
            });
        }

        const building = await Building.findByPk(building_id);
        if (!building) {
            return res.status(404).json({
                success: false,
                message: 'Building not found'
            });
        }
        const equipment = await Equipment.create({
            building_id,
            name,
            status
        });

        await logActivity(req.user.id, 'CREATE', 'EQUIPMENT', equipment.id, `Created equipment: ${equipment.name}`);

        res.status(201).json({
            success: true,
            equipment
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @swagger
 * /equipment/{id}:
 *   put:
 *     summary: Update equipment
 *     tags: [Equipment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Updated HVAC System
 *               category:
 *                 type: string
 *               equipment_type:
 *                 type: string
 *               serial_number:
 *                 type: string
 *               installation_date:
 *                 type: string
 *                 format: date
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, INACTIVE, UNDER_MAINTENANCE]
 *               photo_url:
 *                 type: string
 *     responses:
 *       200:
 *         description: Equipment updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 equipment:
 *                   $ref: '#/components/schemas/Equipment'
 */
const updateEquipment = async (req, res, next) => {
    try {
        const equipment = await Equipment.findByPk(req.params.id);

        if (!equipment) {
            return res.status(404).json({
                success: false,
                message: 'Equipment not found'
            });
        }

        if (req.user.role !== 'SUPER_ADMIN' && equipment.building_id !== req.user.building_id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this equipment'
            });
        }

        if (req.body.building_id && req.user.role !== 'SUPER_ADMIN') {
            delete req.body.building_id;
        }
        const allowedUpdates = {};
        if (typeof req.body.name === 'string' && req.body.name.trim()) {
            allowedUpdates.name = req.body.name.trim();
        }
        if (req.user.role === 'SUPER_ADMIN' && req.body.building_id) {
            allowedUpdates.building_id = req.body.building_id;
        }
        if (typeof req.body.status === 'string') {
            allowedUpdates.status = req.body.status;
        }

        await equipment.update(allowedUpdates);

        await logActivity(req.user.id, 'UPDATE', 'EQUIPMENT', equipment.id, `Updated equipment: ${equipment.name}`);

        res.status(200).json({
            success: true,
            equipment
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @swagger
 * /equipment/{id}:
 *   delete:
 *     summary: Delete equipment
 *     tags: [Equipment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Equipment deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 */
const deleteEquipment = async (req, res, next) => {
    try {
        const equipment = await Equipment.findByPk(req.params.id);

        if (!equipment) {
            return res.status(404).json({
                success: false,
                message: 'Equipment not found'
            });
        }

        if (req.user.role !== 'SUPER_ADMIN' && equipment.building_id !== req.user.building_id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to delete this equipment'
            });
        }

        const taskCount = await Task.count({ where: { equipment_id: equipment.id } });
        if (taskCount > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete equipment with existing tasks'
            });
        }

        await logActivity(req.user.id, 'DELETE', 'EQUIPMENT', equipment.id, `Deleted equipment: ${equipment.name}`);
        await equipment.destroy();

        res.status(200).json({
            success: true,
            message: 'Equipment deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getEquipmentTypes,
    getChecklistByType,
    getChecklistByEquipmentId,
    createAddonChecklistItem,
    getEquipment,
    getEquipmentById,
    createEquipment,
    updateEquipment,
    deleteEquipment
};
