const { sequelize } = require('../config/database');
const { Building, Equipment, Task, User, ActivityLog } = require('../models');
const { Op } = require('sequelize');

/**
 * @swagger
 * tags:
 *   name: Reports
 *   description: Report endpoints
 */

/**
 * @swagger
 * /reports/dashboard:
 *   get:
 *     summary: Get dashboard statistics
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 stats:
 *                   type: object
 *                   properties:
 *                     overview:
 *                       type: object
 *                       properties:
 *                         buildings:
 *                           type: integer
 *                         equipment:
 *                           type: integer
 *                         tasks:
 *                           type: integer
 *                         overdueTasks:
 *                           type: integer
 *                     equipmentByStatus:
 *                       type: array
 *                     tasksByStatus:
 *                       type: array
 *                     recentActivities:
 *                       type: array
 */
const getDashboardStats = async (req, res, next) => {
    try {
        const equipmentWhere = {};
        const taskWhere = {};

        if (req.user.role !== 'SUPER_ADMIN') {
            equipmentWhere.building_id = req.user.building_id;
            taskWhere['$equipment.building_id$'] = req.user.building_id;
        }

        if (req.user.role === 'TECHNICIAN') {
            taskWhere.assigned_to = req.user.id;
        }

        const buildingsCount = req.user.role === 'SUPER_ADMIN' 
            ? await Building.count() 
            : 1;

        const equipmentCount = await Equipment.count({ where: equipmentWhere });

        const tasksCount = await Task.count({ 
            where: taskWhere,
            include: [{
                model: Equipment,
                as: 'equipment',
                required: true,
                attributes: []
            }]
        });

        const equipmentByStatus = [{
            status: 'TOTAL',
            count: equipmentCount
        }];

        const tasksByStatus = await Task.findAll({
            where: taskWhere,
            attributes: [
                'status',
                [sequelize.fn('COUNT', sequelize.col('status')), 'count']
            ],
            group: ['status'],
            include: [{
                model: Equipment,
                as: 'equipment',
                required: true,
                attributes: []
            }]
        });

        const overdueTasks = await Task.count({
            where: {
                ...taskWhere,
                status: { [Op.ne]: 'COMPLETED' },
                due_date: { [Op.lt]: new Date() }
            },
            include: [{
                model: Equipment,
                as: 'equipment',
                required: true,
                attributes: []
            }]
        });

        const recentActivities = await ActivityLog.findAll({
            limit: 10,
            order: [['created_at', 'DESC']],
            include: [{
                model: User,
                as: 'user',
                attributes: ['id', 'name']
            }]
        });

        res.status(200).json({
            success: true,
            stats: {
                overview: {
                    buildings: buildingsCount,
                    equipment: equipmentCount,
                    tasks: tasksCount,
                    overdueTasks
                },
                equipmentByStatus,
                tasksByStatus,
                recentActivities
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @swagger
 * /reports/building/{id}:
 *   get:
 *     summary: Get building report
 *     tags: [Reports]
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
 *         description: Building report
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 report:
 *                   type: object
 *                   properties:
 *                     building:
 *                       $ref: '#/components/schemas/Building'
 *                     equipmentStats:
 *                       type: array
 *                     taskStats:
 *                       type: array
 *                     staffStats:
 *                       type: array
 *                     recentTasks:
 *                       type: array
 */
const getBuildingReport = async (req, res, next) => {
    try {
        const buildingId = req.params.id;

        if (req.user.role !== 'SUPER_ADMIN' && req.user.building_id !== parseInt(buildingId)) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view this building report'
            });
        }

        const building = await Building.findByPk(buildingId);
        if (!building) {
            return res.status(404).json({
                success: false,
                message: 'Building not found'
            });
        }

        const buildingEquipmentCount = await Equipment.count({
            where: { building_id: buildingId }
        });
        const equipmentStats = [{
            status: 'TOTAL',
            count: buildingEquipmentCount
        }];

        const taskStats = await Task.findAll({
            where: {
                '$equipment.building_id$': buildingId
            },
            attributes: [
                'status',
                [sequelize.fn('COUNT', sequelize.col('status')), 'count']
            ],
            group: ['status'],
            include: [{
                model: Equipment,
                as: 'equipment',
                required: true,
                attributes: []
            }]
        });

        const staffStats = await User.findAll({
            where: { building_id: buildingId, is_active: true },
            attributes: [
                'role',
                [sequelize.fn('COUNT', sequelize.col('role')), 'count']
            ],
            group: ['role']
        });

        const recentTasks = await Task.findAll({
            where: {
                '$equipment.building_id$': buildingId
            },
            limit: 10,
            order: [['created_at', 'DESC']],
            include: [
                {
                    model: Equipment,
                    as: 'equipment',
                    attributes: ['id', 'name']
                },
                {
                    model: User,
                    as: 'assignee',
                    attributes: ['id', 'name']
                }
            ]
        });

        res.status(200).json({
            success: true,
            report: {
                building,
                equipmentStats,
                taskStats,
                staffStats,
                recentTasks
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @swagger
 * /reports/equipment/{id}:
 *   get:
 *     summary: Get equipment report
 *     tags: [Reports]
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
 *         description: Equipment report
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 report:
 *                   type: object
 *                   properties:
 *                     equipment:
 *                       $ref: '#/components/schemas/Equipment'
 *                     taskHistory:
 *                       type: array
 *                     taskStats:
 *                       type: array
 *                     avgCompletionHours:
 *                       type: number
 */
const getEquipmentReport = async (req, res, next) => {
    try {
        const equipmentId = req.params.id;

        const equipment = await Equipment.findByPk(equipmentId, {
            include: ['building']
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
                message: 'Not authorized to view this equipment report'
            });
        }

        const taskHistory = await Task.findAll({
            where: { equipment_id: equipmentId },
            include: [
                {
                    model: User,
                    as: 'assignee',
                    attributes: ['id', 'name']
                }
            ],
            order: [['created_at', 'DESC']]
        });

        const taskStats = await Task.findAll({
            where: { equipment_id: equipmentId },
            attributes: [
                'status',
                [sequelize.fn('COUNT', sequelize.col('status')), 'count']
            ],
            group: ['status']
        });

        const completedTasks = await Task.findAll({
            where: {
                equipment_id: equipmentId,
                status: 'COMPLETED',
                completed_at: { [Op.ne]: null }
            },
            attributes: [
                [sequelize.fn('AVG', sequelize.literal('TIMESTAMPDIFF(HOUR, created_at, completed_at)')), 'avg_completion_hours']
            ]
        });

        res.status(200).json({
            success: true,
            report: {
                equipment,
                taskHistory,
                taskStats,
                avgCompletionHours: completedTasks[0]?.dataValues.avg_completion_hours || 0
            }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getDashboardStats,
    getBuildingReport,
    getEquipmentReport
};
