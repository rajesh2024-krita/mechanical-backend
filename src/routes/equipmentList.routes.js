const express = require('express');
const router = express.Router();
const {
    getEquipmentList,
    getEquipmentListById,
    createEquipmentListEntry,
    updateEquipmentListEntry,
    deleteEquipmentListEntry
} = require('../controllers/equipmentList.controller');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

/**
 * @swagger
 * tags:
 *   name: EquipmentList
 *   description: Equipment list endpoints
 */

/**
 * @swagger
 * /equipment-list:
 *   get:
 *     summary: Get equipment list entries
 *     tags: [EquipmentList]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: equipment_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Equipment list entries
 */
router.get('/', protect, authorize('SUPER_ADMIN', 'MANAGER', 'TECHNICIAN'), getEquipmentList);

/**
 * @swagger
 * /equipment-list/{id}:
 *   get:
 *     summary: Get equipment list entry by ID
 *     tags: [EquipmentList]
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
 *         description: Equipment list entry
 *       404:
 *         description: Entry not found
 */
router.get('/:id', protect, authorize('SUPER_ADMIN', 'MANAGER', 'TECHNICIAN'), getEquipmentListById);

/**
 * @swagger
 * /equipment-list:
 *   post:
 *     summary: Create equipment list entry
 *     tags: [EquipmentList]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EquipmentList'
 *     responses:
 *       201:
 *         description: Entry created
 */
router.post('/', protect, authorize('SUPER_ADMIN', 'MANAGER'), createEquipmentListEntry);

/**
 * @swagger
 * /equipment-list/{id}:
 *   put:
 *     summary: Update equipment list entry
 *     tags: [EquipmentList]
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
 *             $ref: '#/components/schemas/EquipmentList'
 *     responses:
 *       200:
 *         description: Entry updated
 */
router.put('/:id', protect, authorize('SUPER_ADMIN', 'MANAGER'), updateEquipmentListEntry);

/**
 * @swagger
 * /equipment-list/{id}:
 *   delete:
 *     summary: Delete equipment list entry
 *     tags: [EquipmentList]
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
 *         description: Entry deleted
 */
router.delete('/:id', protect, authorize('SUPER_ADMIN', 'MANAGER'), deleteEquipmentListEntry);

module.exports = router;
