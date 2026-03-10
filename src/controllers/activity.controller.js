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
 *     ActivityLogInput:
 *       type: object
 *       required:
 *         - action_type
 *         - entity_type
 *       properties:
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

/**
 * @swagger
 * /activity:
 *   post:
 *     summary: Create a new activity log entry
 *     tags: [Activity]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ActivityLogInput'
 *     responses:
 *       201:
 *         description: Activity log created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 activity:
 *                   $ref: '#/components/schemas/ActivityLog'
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
const createActivity = async (req, res, next) => {
    try {
        const { user_id, action_type, entity_type, entity_id, description } = req.body;

        // Validate required fields
        if (!action_type || !entity_type) {
            return res.status(400).json({
                success: false,
                message: 'action_type and entity_type are required'
            });
        }

        // Create the activity log
        const activity = await ActivityLog.create({
            user_id: user_id || req.user.id, // Use provided user_id or current user
            action_type,
            entity_type,
            entity_id,
            description
        });

        // Fetch the created activity with user details
        const activityWithUser = await ActivityLog.findByPk(activity.id, {
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'name', 'email', 'role', 'building_id']
                }
            ]
        });

        res.status(201).json({
            success: true,
            activity: activityWithUser
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @swagger
 * /activity/{id}:
 *   get:
 *     summary: Get a single activity log by ID
 *     tags: [Activity]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Activity log ID
 *     responses:
 *       200:
 *         description: Activity log details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 activity:
 *                   $ref: '#/components/schemas/ActivityLog'
 *       404:
 *         description: Activity log not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
const getActivity = async (req, res, next) => {
    try {
        const { id } = req.params;

        const activity = await ActivityLog.findByPk(id, {
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'name', 'email', 'role', 'building_id']
                }
            ]
        });

        if (!activity) {
            return res.status(404).json({
                success: false,
                message: 'Activity log not found'
            });
        }

        // Check if user can access this activity (same building restriction)
        if (req.user.role !== 'SUPER_ADMIN' && activity.user && activity.user.building_id !== req.user.building_id) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        res.status(200).json({
            success: true,
            activity
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @swagger
 * /activity/{id}:
 *   put:
 *     summary: Update an activity log entry
 *     tags: [Activity]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Activity log ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ActivityLogInput'
 *     responses:
 *       200:
 *         description: Activity log updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 activity:
 *                   $ref: '#/components/schemas/ActivityLog'
 *       404:
 *         description: Activity log not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
const updateActivity = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { user_id, action_type, entity_type, entity_id, description } = req.body;

        const activity = await ActivityLog.findByPk(id);

        if (!activity) {
            return res.status(404).json({
                success: false,
                message: 'Activity log not found'
            });
        }

        // Check if user can access this activity (same building restriction)
        if (req.user.role !== 'SUPER_ADMIN') {
            const activityUser = await User.findByPk(activity.user_id);
            if (activityUser && activityUser.building_id !== req.user.building_id) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied'
                });
            }
        }

        // Update the activity log
        await activity.update({
            user_id: user_id || activity.user_id,
            action_type: action_type || activity.action_type,
            entity_type: entity_type || activity.entity_type,
            entity_id: entity_id !== undefined ? entity_id : activity.entity_id,
            description: description !== undefined ? description : activity.description
        });

        // Fetch the updated activity with user details
        const updatedActivity = await ActivityLog.findByPk(id, {
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'name', 'email', 'role', 'building_id']
                }
            ]
        });

        res.status(200).json({
            success: true,
            activity: updatedActivity
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @swagger
 * /activity/{id}:
 *   delete:
 *     summary: Delete an activity log entry
 *     tags: [Activity]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Activity log ID
 *     responses:
 *       200:
 *         description: Activity log deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       404:
 *         description: Activity log not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
const deleteActivity = async (req, res, next) => {
    try {
        const { id } = req.params;

        const activity = await ActivityLog.findByPk(id);

        if (!activity) {
            return res.status(404).json({
                success: false,
                message: 'Activity log not found'
            });
        }

        // Check if user can access this activity (same building restriction)
        if (req.user.role !== 'SUPER_ADMIN') {
            const activityUser = await User.findByPk(activity.user_id);
            if (activityUser && activityUser.building_id !== req.user.building_id) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied'
                });
            }
        }

        await activity.destroy();

        res.status(200).json({
            success: true,
            message: 'Activity log deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getActivities,
    getActivityStats,
    createActivity,
    getActivity,
    updateActivity,
    deleteActivity
};
