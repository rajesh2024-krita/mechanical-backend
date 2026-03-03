const { Building, User, Equipment } = require('../models');
const { logActivity } = require('../services/activity.service');

/**
 * @swagger
 * tags:
 *   name: Buildings
 *   description: Building management endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Building:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         name:
 *           type: string
 *           example: Main Building
 *         location:
 *           type: string
 *           example: 123 Main St, City
 *         description:
 *           type: string
 *           example: Headquarters
 *         created_at:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /buildings:
 *   get:
 *     summary: Get all buildings
 *     tags: [Buildings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of buildings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                 buildings:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Building'
 */
const getBuildings = async (req, res, next) => {
    try {
        const where = {};
        
        if (req.user.role !== 'SUPER_ADMIN') {
            where.id = req.user.building_id;
        }

        const buildings = await Building.findAll({
            where,
            include: [
                {
                    model: User,
                    as: 'users',
                    attributes: ['id', 'name', 'email', 'role'],
                    required: false
                },
                {
                    model: Equipment,
                    as: 'equipment',
                    attributes: ['id', 'name', 'status'],
                    required: false
                }
            ]
        });

        res.status(200).json({
            success: true,
            count: buildings.length,
            buildings
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @swagger
 * /buildings/{id}:
 *   get:
 *     summary: Get building by ID
 *     tags: [Buildings]
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
 *         description: Building details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 building:
 *                   $ref: '#/components/schemas/Building'
 *       404:
 *         description: Building not found
 */
const getBuildingById = async (req, res, next) => {
    try {
        const building = await Building.findByPk(req.params.id, {
            include: [
                {
                    model: User,
                    as: 'users',
                    attributes: ['id', 'name', 'email', 'role'],
                    required: false
                },
                {
                    model: Equipment,
                    as: 'equipment',
                    required: false
                }
            ]
        });

        if (!building) {
            return res.status(404).json({
                success: false,
                message: 'Building not found'
            });
        }

        if (req.user.role !== 'SUPER_ADMIN' && req.user.building_id !== building.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view this building'
            });
        }

        res.status(200).json({
            success: true,
            building
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @swagger
 * /buildings:
 *   post:
 *     summary: Create new building
 *     tags: [Buildings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: New Building
 *               location:
 *                 type: string
 *                 example: 456 Oak Ave
 *               description:
 *                 type: string
 *                 example: New facility
 *     responses:
 *       201:
 *         description: Building created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 building:
 *                   $ref: '#/components/schemas/Building'
 */
const createBuilding = async (req, res, next) => {
    try {
        const building = await Building.create(req.body);

        await logActivity(req.user.id, 'CREATE', 'BUILDING', building.id, `Created building: ${building.name}`);

        res.status(201).json({
            success: true,
            building
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @swagger
 * /buildings/{id}:
 *   put:
 *     summary: Update building
 *     tags: [Buildings]
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
 *                 example: Updated Building
 *               location:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Building updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 building:
 *                   $ref: '#/components/schemas/Building'
 */
const updateBuilding = async (req, res, next) => {
    try {
        const building = await Building.findByPk(req.params.id);

        if (!building) {
            return res.status(404).json({
                success: false,
                message: 'Building not found'
            });
        }

        if (req.user.role !== 'SUPER_ADMIN' && req.user.building_id !== building.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this building'
            });
        }

        await building.update(req.body);

        await logActivity(req.user.id, 'UPDATE', 'BUILDING', building.id, `Updated building: ${building.name}`);

        res.status(200).json({
            success: true,
            building
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @swagger
 * /buildings/{id}:
 *   delete:
 *     summary: Delete building
 *     tags: [Buildings]
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
 *         description: Building deleted
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
const deleteBuilding = async (req, res, next) => {
    try {
        const building = await Building.findByPk(req.params.id);

        if (!building) {
            return res.status(404).json({
                success: false,
                message: 'Building not found'
            });
        }

        const userCount = await User.count({ where: { building_id: building.id } });
        const equipmentCount = await Equipment.count({ where: { building_id: building.id } });

        if (userCount > 0 || equipmentCount > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete building with existing users or equipment'
            });
        }

        await logActivity(req.user.id, 'DELETE', 'BUILDING', building.id, `Deleted building: ${building.name}`);
        await building.destroy();

        res.status(200).json({
            success: true,
            message: 'Building deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getBuildings,
    getBuildingById,
    createBuilding,
    updateBuilding,
    deleteBuilding
};