const { Task, Equipment, User, Building, TaskChecklist } = require('../models');
const { logActivity } = require('../services/activity.service');
const { Op } = require('sequelize');

const TASK_META_MARKER = '\n\n__MM_META__:';

const parseChecklistResultsFromPayload = (payload = {}) => {
    if (Array.isArray(payload.checklist_results)) {
        return payload.checklist_results;
    }
    if (Array.isArray(payload.checklistResults)) {
        return payload.checklistResults;
    }

    const description = String(payload.description || '');
    const markerIndex = description.indexOf(TASK_META_MARKER);
    if (markerIndex === -1) {
        return [];
    }
    const metaRaw = description.slice(markerIndex + TASK_META_MARKER.length).trim();
    try {
        const parsed = JSON.parse(metaRaw);
        if (Array.isArray(parsed?.checklistResults)) {
            return parsed.checklistResults;
        }
    } catch (_err) {
        return [];
    }
    return [];
};

const syncTaskChecklist = async (taskId, checklistRows, userId) => {
    await TaskChecklist.destroy({ where: { task_id: taskId } });

    if (!Array.isArray(checklistRows) || checklistRows.length === 0) {
        return;
    }

    const normalizedRows = checklistRows
        .filter((item) => item && String(item.point || '').trim())
        .map((item) => ({
            task_id: taskId,
            updated_by: userId || null,
            point: String(item.point || '').trim(),
            status: (String(item.status || 'PENDING').toUpperCase()),
            initials: item.initials ? String(item.initials).trim() : null,
            measured_value: item.measuredValue ? String(item.measuredValue).trim() : null,
            bms_reading: item.bmsReading ? String(item.bmsReading).trim() : null,
            remarks: item.remarks ? String(item.remarks).trim() : null
        }));

    if (normalizedRows.length > 0) {
        await TaskChecklist.bulkCreate(normalizedRows);
    }
};

/**
 * @swagger
 * tags:
 *   name: Tasks
 *   description: Task management endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Task:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         equipment_id:
 *           type: integer
 *           example: 1
 *         assigned_to:
 *           type: integer
 *           nullable: true
 *           example: 3
 *         priority:
 *           type: string
 *           enum: [LOW, MEDIUM, HIGH]
 *           example: HIGH
 *         status:
 *           type: string
 *           enum: [PENDING, IN_PROGRESS, COMPLETED]
 *           example: PENDING
 *         description:
 *           type: string
 *           example: Perform routine maintenance on HVAC system
 *         due_date:
 *           type: string
 *           format: date
 *           example: 2024-03-01
 *         completed_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 */

/**
 * @swagger
 * /tasks:
 *   get:
 *     summary: Get all tasks
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, IN_PROGRESS, COMPLETED]
 *         description: Filter by status
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [LOW, MEDIUM, HIGH]
 *         description: Filter by priority
 *       - in: query
 *         name: assigned_to
 *         schema:
 *           type: integer
 *         description: Filter by assigned user
 *       - in: query
 *         name: building_id
 *         schema:
 *           type: integer
 *         description: Filter by building
 *     responses:
 *       200:
 *         description: List of tasks
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                 tasks:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Task'
 */
const getTasks = async (req, res, next) => {
    try {
        const where = {};
        const equipmentWhere = {};

        if (req.query.status) {
            where.status = req.query.status;
        }
        if (req.query.priority) {
            where.priority = req.query.priority;
        }
        if (req.query.assigned_to) {
            where.assigned_to = req.query.assigned_to;
        }

        if (req.query.building_id) {
            if (req.user.role === 'SUPER_ADMIN' || req.user.building_id === parseInt(req.query.building_id)) {
                equipmentWhere.building_id = req.query.building_id;
            } else {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to view tasks from this building'
                });
            }
        } else if (req.user.role !== 'SUPER_ADMIN') {
            equipmentWhere.building_id = req.user.building_id;
        }

        const tasks = await Task.findAll({
            where,
            include: [
                {
                    model: Equipment,
                    as: 'equipment',
                    where: equipmentWhere,
                    include: [
                        {
                            model: Building,
                            as: 'building',
                            attributes: ['id', 'name']
                        }
                    ]
                },
                {
                    model: User,
                    as: 'assignee',
                    attributes: ['id', 'name', 'email']
                },
                {
                    model: TaskChecklist,
                    as: 'checklistItems',
                    include: [
                        {
                            model: User,
                            as: 'updatedBy',
                            attributes: ['id', 'name', 'email']
                        }
                    ]
                }
            ],
            order: [
                ['due_date', 'ASC'],
                ['priority', 'DESC']
            ]
        });

        res.status(200).json({
            success: true,
            count: tasks.length,
            tasks
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @swagger
 * /tasks/{id}:
 *   get:
 *     summary: Get task by ID
 *     tags: [Tasks]
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
 *         description: Task details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 task:
 *                   $ref: '#/components/schemas/Task'
 */
const getTaskById = async (req, res, next) => {
    try {
        const task = await Task.findByPk(req.params.id, {
            include: [
                {
                    model: Equipment,
                    as: 'equipment',
                    include: [
                        {
                            model: Building,
                            as: 'building',
                            attributes: ['id', 'name']
                        }
                    ]
                },
                {
                    model: User,
                    as: 'assignee',
                    attributes: ['id', 'name', 'email']
                },
                {
                    model: TaskChecklist,
                    as: 'checklistItems',
                    include: [
                        {
                            model: User,
                            as: 'updatedBy',
                            attributes: ['id', 'name', 'email']
                        }
                    ]
                }
            ]
        });

        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task not found'
            });
        }

        if (req.user.role !== 'SUPER_ADMIN') {
            const taskBuildingId = task.equipment?.building_id;
            if (!taskBuildingId || taskBuildingId !== req.user.building_id) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to view this task'
                });
            }
        }

        res.status(200).json({
            success: true,
            task
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @swagger
 * /tasks:
 *   post:
 *     summary: Create new task
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - equipment_id
 *               - description
 *             properties:
 *               equipment_id:
 *                 type: integer
 *                 example: 1
 *               assigned_to:
 *                 type: integer
 *                 example: 3
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH]
 *                 default: MEDIUM
 *               description:
 *                 type: string
 *                 example: Perform routine maintenance on HVAC system
 *               due_date:
 *                 type: string
 *                 format: date
 *                 example: 2024-03-01
 *     responses:
 *       201:
 *         description: Task created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 task:
 *                   $ref: '#/components/schemas/Task'
 */
const createTask = async (req, res, next) => {
    try {
        const { equipment_id, assigned_to, priority, description, due_date } = req.body;

        const equipment = await Equipment.findByPk(equipment_id, {
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
                message: 'You can only create tasks for equipment in your building'
            });
        }

        const resolvedAssignedTo = req.user.role === 'TECHNICIAN' ? req.user.id : assigned_to;

        if (resolvedAssignedTo) {
            const assignee = await User.findByPk(resolvedAssignedTo);
            if (!assignee) {
                return res.status(404).json({
                    success: false,
                    message: 'Assigned user not found'
                });
            }

            if (req.user.role !== 'SUPER_ADMIN' && assignee.building_id !== req.user.building_id) {
                return res.status(403).json({
                    success: false,
                    message: 'Cannot assign task to user from different building'
                });
            }
        }

        const task = await Task.create({
            equipment_id,
            assigned_to: resolvedAssignedTo,
            priority,
            description,
            due_date,
            status: 'PENDING'
        });

        const checklistResults = parseChecklistResultsFromPayload(req.body);
        await syncTaskChecklist(task.id, checklistResults, req.user.id);

        await logActivity(req.user.id, 'CREATE', 'TASK', task.id, `Created task for equipment: ${equipment.name}`);

        const createdTask = await Task.findByPk(task.id, {
            include: [
                {
                    model: Equipment,
                    as: 'equipment',
                    include: ['building']
                },
                {
                    model: User,
                    as: 'assignee',
                    attributes: ['id', 'name', 'email']
                },
                {
                    model: TaskChecklist,
                    as: 'checklistItems',
                    include: [
                        {
                            model: User,
                            as: 'updatedBy',
                            attributes: ['id', 'name', 'email']
                        }
                    ]
                }
            ]
        });

        res.status(201).json({
            success: true,
            task: createdTask
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @swagger
 * /tasks/{id}:
 *   put:
 *     summary: Update task
 *     tags: [Tasks]
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
 *               assigned_to:
 *                 type: integer
 *                 example: 3
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH]
 *               status:
 *                 type: string
 *                 enum: [PENDING, IN_PROGRESS, COMPLETED]
 *               description:
 *                 type: string
 *               due_date:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: Task updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 task:
 *                   $ref: '#/components/schemas/Task'
 */
const updateTask = async (req, res, next) => {
    try {
        const checklistResults = parseChecklistResultsFromPayload(req.body);
        const task = await Task.findByPk(req.params.id, {
            include: ['equipment']
        });

        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task not found'
            });
        }

        if (req.user.role !== 'SUPER_ADMIN') {
            const buildingId = task.equipment.building_id;
            if (req.user.building_id !== buildingId) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to update this task'
                });
            }

            if (req.user.role === 'TECHNICIAN') {
                const allowedFields = ['status', 'description'];
                Object.keys(req.body).forEach(key => {
                    if (!allowedFields.includes(key)) {
                        delete req.body[key];
                    }
                });
            }
        }

        if (req.body.status === 'COMPLETED' && task.status !== 'COMPLETED') {
            req.body.completed_at = new Date();
        }

        await task.update(req.body);
        await syncTaskChecklist(task.id, checklistResults, req.user.id);

        await logActivity(req.user.id, 'UPDATE', 'TASK', task.id, `Updated task: ${task.description.substring(0, 50)}...`);

        const updatedTask = await Task.findByPk(task.id, {
            include: [
                {
                    model: Equipment,
                    as: 'equipment',
                    include: ['building']
                },
                {
                    model: User,
                    as: 'assignee',
                    attributes: ['id', 'name', 'email']
                },
                {
                    model: TaskChecklist,
                    as: 'checklistItems',
                    include: [
                        {
                            model: User,
                            as: 'updatedBy',
                            attributes: ['id', 'name', 'email']
                        }
                    ]
                }
            ]
        });

        res.status(200).json({
            success: true,
            task: updatedTask
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @swagger
 * /tasks/{id}:
 *   delete:
 *     summary: Delete task
 *     tags: [Tasks]
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
 *         description: Task deleted
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
const deleteTask = async (req, res, next) => {
    try {
        const task = await Task.findByPk(req.params.id, {
            include: ['equipment']
        });

        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task not found'
            });
        }

        if (req.user.role !== 'SUPER_ADMIN') {
            const buildingId = task.equipment.building_id;
            if (req.user.building_id !== buildingId) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to delete this task'
                });
            }

            if (req.user.role === 'TECHNICIAN') {
                return res.status(403).json({
                    success: false,
                    message: 'Technicians cannot delete tasks'
                });
            }
        }

        await logActivity(req.user.id, 'DELETE', 'TASK', task.id, `Deleted task: ${task.description.substring(0, 50)}...`);
        await task.destroy();

        res.status(200).json({
            success: true,
            message: 'Task deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getTasks,
    getTaskById,
    createTask,
    updateTask,
    deleteTask
};
