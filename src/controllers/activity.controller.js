const { ActivityLog, User } = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * @swagger
 * tags:
 *   name: Activity
 *   description: Activity log endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     ActivityLog:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         user_id:
 *           type: integer
 *           example: 1
 *         action_type:
 *           type: string
 *           example: CREATE
 *         entity_type:
 *           type: string
 *           example: EQUIPMENT
 *         entity_id:
 *           type: integer
 *           example: 1
 *         description:
 *           type: string
 *           example: Created equipment: HVAC System
 *         created_at:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /activity:
 *   get:
 *     summary: Get activity logs
 *     tags: [Activity]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: entity_type
 *         schema:
 *           type: string
 *         description: Filter by entity type
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: integer
 *         description: Filter by user
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for logs
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for logs
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Number of logs to return
 *     responses:
 *       200:
 *         description: List of activity logs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                 activities:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ActivityLog'
 */
const getActivities = async (req, res, next) => {
    try {
        const where = {};
        const userWhere = {};
        const andConditions = [];

        if (req.query.entity_type) {
            where.entity_type = req.query.entity_type;
        }

        if (req.query.action_type) {
            where.action_type = req.query.action_type;
        }

        if (req.query.user_id) {
            where.user_id = req.query.user_id;
        }

        if (req.query.role) {
            userWhere.role = req.query.role;
        }

        if (req.query.name) {
            const nameSearch = `%${String(req.query.name).trim()}%`;
            userWhere[Op.or] = [
                { name: { [Op.like]: nameSearch } },
                { email: { [Op.like]: nameSearch } }
            ];
        }

        if (req.query.start_date || req.query.end_date) {
            where.created_at = {};
            if (req.query.start_date) {
                where.created_at[Op.gte] = new Date(req.query.start_date);
            }
            if (req.query.end_date) {
                const endDate = new Date(req.query.end_date);
                endDate.setHours(23, 59, 59, 999);
                where.created_at[Op.lte] = endDate;
            }
        }

        if (req.query.search) {
            const searchValue = `%${String(req.query.search).trim()}%`;
            andConditions.push({
                [Op.or]: [
                    { description: { [Op.like]: searchValue } },
                    { action_type: { [Op.like]: searchValue } },
                    { entity_type: { [Op.like]: searchValue } }
                ]
            });
        }

        if (andConditions.length > 0) {
            where[Op.and] = andConditions;
        }

        if (req.user.role !== 'SUPER_ADMIN') {
            userWhere.building_id = req.user.building_id;
            if (!req.query.user_id) {
                // Managers can inspect their own building activity only.
                userWhere.role = userWhere.role || { [Op.in]: ['MANAGER', 'TECHNICIAN'] };
            }
        }

        const limit = parseInt(req.query.limit) || 100;

        const activities = await ActivityLog.findAll({
            where,
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'name', 'email', 'role', 'building_id'],
                    where: userWhere,
                    required: Object.keys(userWhere).length > 0
                }
            ],
            order: [['created_at', 'DESC']],
            limit
        });

        res.status(200).json({
            success: true,
            count: activities.length,
            activities
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @swagger
 * /activity/stats:
 *   get:
 *     summary: Get activity statistics
 *     tags: [Activity]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Activity statistics
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
 *                     byEntityType:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           entity_type:
 *                             type: string
 *                           count:
 *                             type: integer
 *                     today:
 *                       type: integer
 *                     total:
 *                       type: integer
 */
const getActivityStats = async (req, res, next) => {
    try {
        const stats = await ActivityLog.findAll({
            attributes: [
                'entity_type',
                [sequelize.fn('COUNT', sequelize.col('entity_type')), 'count']
            ],
            group: ['entity_type'],
            order: [[sequelize.fn('COUNT', sequelize.col('entity_type')), 'DESC']]
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayCount = await ActivityLog.count({
            where: {
                created_at: {
                    [Op.gte]: today
                }
            }
        });

        res.status(200).json({
            success: true,
            stats: {
                byEntityType: stats,
                today: todayCount,
                total: await ActivityLog.count()
            }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getActivities,
    getActivityStats
};
