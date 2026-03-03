const express = require('express');
const router = express.Router();
const {
    getEquipmentTypes,
    getChecklistByType,
    getChecklistByEquipmentId,
    createAddonChecklistItem,
    getEquipment,
    getEquipmentById,
    createEquipment,
    updateEquipment,
    deleteEquipment
} = require('../controllers/equipment.controller');
const { protect } = require('../middleware/auth.middleware');
const { authorize, checkBuildingAccess } = require('../middleware/role.middleware');

/**
 * @swagger
 * tags:
 *   name: Equipment
 *   description: Equipment management endpoints
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
 *       401:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', protect, authorize('SUPER_ADMIN', 'MANAGER', 'TECHNICIAN'), getEquipment);
router.get('/types', protect, authorize('SUPER_ADMIN', 'MANAGER', 'TECHNICIAN'), getEquipmentTypes);
router.get('/checklists/:equipmentType', protect, authorize('SUPER_ADMIN', 'MANAGER', 'TECHNICIAN'), getChecklistByType);
router.get('/:id/checklists', protect, authorize('SUPER_ADMIN', 'MANAGER', 'TECHNICIAN'), getChecklistByEquipmentId);
router.post(
    '/checklists/:equipmentType/addons',
    protect,
    authorize('SUPER_ADMIN', 'MANAGER'),
    createAddonChecklistItem
);

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
 *         description: Equipment ID
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
router.get('/:id', protect, authorize('SUPER_ADMIN', 'MANAGER', 'TECHNICIAN'), checkBuildingAccess, getEquipmentById);

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
 *       400:
 *         description: Validation error
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
router.post('/', protect, authorize('SUPER_ADMIN', 'MANAGER'), checkBuildingAccess, createEquipment);

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
 *         description: Equipment ID
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
router.put('/:id', protect, authorize('SUPER_ADMIN', 'MANAGER'), checkBuildingAccess, updateEquipment);

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
 *         description: Equipment ID
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
 *                   example: Equipment deleted successfully
 *       400:
 *         description: Cannot delete equipment with existing tasks
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
router.delete('/:id', protect, authorize('SUPER_ADMIN', 'MANAGER'), checkBuildingAccess, deleteEquipment);

module.exports = router;
