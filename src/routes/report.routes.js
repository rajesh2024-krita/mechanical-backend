const express = require('express');
const router = express.Router();
const {
    getDashboardStats,
    getBuildingReport,
    getEquipmentReport
} = require('../controllers/report.controller');
const { protect } = require('../middleware/auth.middleware');
const { authorize, checkBuildingAccess } = require('../middleware/role.middleware');

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
 *       401:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/dashboard', protect, authorize('SUPER_ADMIN', 'MANAGER', 'TECHNICIAN'), getDashboardStats);

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
 *         description: Building ID
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
 *       404:
 *         description: Building not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/building/:id', protect, authorize('SUPER_ADMIN', 'MANAGER'), checkBuildingAccess, getBuildingReport);

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
 *         description: Equipment ID
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
 *       404:
 *         description: Equipment not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/equipment/:id', protect, authorize('SUPER_ADMIN', 'MANAGER', 'TECHNICIAN'), checkBuildingAccess, getEquipmentReport);

module.exports = router;