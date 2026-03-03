const path = require('path');
const fs = require('fs');
const { Equipment, Task } = require('../models');
const { logActivity } = require('../services/activity.service');

/**
 * @swagger
 * tags:
 *   name: Upload
 *   description: File upload endpoints
 */

/**
 * @swagger
 * /upload/equipment/{id}:
 *   post:
 *     summary: Upload equipment photo
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               photo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Photo uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 photo_url:
 *                   type: string
 */
const uploadEquipmentPhoto = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Please upload a file'
            });
        }

        const equipmentId = req.params.id;
        const equipment = await Equipment.findByPk(equipmentId);

        if (!equipment) {
            fs.unlinkSync(req.file.path);
            return res.status(404).json({
                success: false,
                message: 'Equipment not found'
            });
        }

        if (req.user.role !== 'SUPER_ADMIN' && equipment.building_id !== req.user.building_id) {
            fs.unlinkSync(req.file.path);
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this equipment'
            });
        }

        const photoUrl = `/uploads/${req.file.filename}`;

        await logActivity(req.user.id, 'UPLOAD', 'EQUIPMENT', equipment.id, `Uploaded photo for equipment: ${equipment.name}`);

        res.status(200).json({
            success: true,
            message: 'Photo uploaded successfully',
            photo_url: photoUrl
        });
    } catch (error) {
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        next(error);
    }
};

/**
 * @swagger
 * /upload/task/{id}:
 *   post:
 *     summary: Upload task attachment
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               attachment:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Attachment uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 attachment_url:
 *                   type: string
 */
const uploadTaskAttachment = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Please upload a file'
            });
        }

        const taskId = req.params.id;
        const task = await Task.findByPk(taskId, {
            include: ['equipment']
        });

        if (!task) {
            fs.unlinkSync(req.file.path);
            return res.status(404).json({
                success: false,
                message: 'Task not found'
            });
        }

        if (req.user.role !== 'SUPER_ADMIN') {
            const buildingId = task.equipment.building_id;
            if (req.user.building_id !== buildingId) {
                fs.unlinkSync(req.file.path);
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to update this task'
                });
            }

            if (req.user.role === 'TECHNICIAN' && task.assigned_to !== req.user.id) {
                fs.unlinkSync(req.file.path);
                return res.status(403).json({
                    success: false,
                    message: 'You can only upload attachments to your assigned tasks'
                });
            }
        }

        const attachmentUrl = `/uploads/${req.file.filename}`;

        await logActivity(req.user.id, 'UPLOAD', 'TASK', task.id, `Uploaded attachment for task`);

        res.status(200).json({
            success: true,
            message: 'Attachment uploaded successfully',
            attachment_url: attachmentUrl
        });
    } catch (error) {
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        next(error);
    }
};

module.exports = {
    uploadEquipmentPhoto,
    uploadTaskAttachment
};
