const { User, Building } = require('../models');
const { logActivity } = require('../services/activity.service');

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User management endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         name:
 *           type: string
 *           example: John Doe
 *         email:
 *           type: string
 *           format: email
 *           example: john@example.com
 *         role:
 *           type: string
 *           enum: [SUPER_ADMIN, MANAGER, TECHNICIAN]
 *           example: TECHNICIAN
 *         building_id:
 *           type: integer
 *           nullable: true
 *           example: 1
 *         is_active:
 *           type: boolean
 *           example: true
 *         created_at:
 *           type: string
 *           format: date-time
 *     Error:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           example: Error message
 */

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Get all users
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [SUPER_ADMIN, MANAGER, TECHNICIAN]
 *         description: Filter by role
 *       - in: query
 *         name: building_id
 *         schema:
 *           type: integer
 *         description: Filter by building
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                 users:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *       401:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
const getUsers = async (req, res, next) => {
    try {
        const where = {};
        
        if (req.query.role) {
            where.role = req.query.role;
        }
        
        if (req.query.building_id) {
            if (req.user.role === 'SUPER_ADMIN' || req.user.building_id === parseInt(req.query.building_id)) {
                where.building_id = req.query.building_id;
            } else {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to view users from this building'
                });
            }
        } else if (req.user.role !== 'SUPER_ADMIN') {
            where.building_id = req.user.building_id;
        }

        const users = await User.findAll({
            where,
            attributes: { exclude: ['password'] },
            include: ['building']
        });

        res.status(200).json({
            success: true,
            count: users.length,
            users
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags: [Users]
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
 *         description: User details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
const getUserById = async (req, res, next) => {
    try {
        const user = await User.findByPk(req.params.id, {
            attributes: { exclude: ['password'] },
            include: ['building']
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (req.user.role !== 'SUPER_ADMIN' && user.building_id !== req.user.building_id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view this user'
            });
        }

        res.status(200).json({
            success: true,
            user
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @swagger
 * /users:
 *   post:
 *     summary: Create new user
 *     tags: [Users]
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
 *               - email
 *               - password
 *               - role
 *             properties:
 *               name:
 *                 type: string
 *                 example: Jane Smith
 *               email:
 *                 type: string
 *                 format: email
 *                 example: jane@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: password123
 *               role:
 *                 type: string
 *                 enum: [SUPER_ADMIN, MANAGER, TECHNICIAN]
 *                 example: TECHNICIAN
 *               building_id:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
const createUser = async (req, res, next) => {
    try {
        const { name, email, password, role, building_id } = req.body;

        if (req.user.role !== 'SUPER_ADMIN') {
            if (building_id && building_id !== req.user.building_id) {
                return res.status(403).json({
                    success: false,
                    message: 'You can only create users in your building'
                });
            }
            req.body.building_id = req.user.building_id;
        }

        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User already exists with this email'
            });
        }

        const user = await User.create({
            name,
            email,
            password,
            role,
            building_id: req.body.building_id
        });

        await logActivity(req.user.id, 'CREATE', 'USER', user.id, `Created user: ${user.name}`);

        const userData = user.toJSON();
        delete userData.password;

        res.status(201).json({
            success: true,
            user: userData
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @swagger
 * /users/{id}:
 *   put:
 *     summary: Update user
 *     tags: [Users]
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
 *                 example: Jane Updated
 *               email:
 *                 type: string
 *                 format: email
 *                 example: jane.updated@example.com
 *               role:
 *                 type: string
 *                 enum: [SUPER_ADMIN, MANAGER, TECHNICIAN]
 *               building_id:
 *                 type: integer
 *               is_active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: User updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
const updateUser = async (req, res, next) => {
    try {
        const user = await User.findByPk(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (req.user.role !== 'SUPER_ADMIN' && user.building_id !== req.user.building_id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this user'
            });
        }

        if (req.body.role && req.user.role !== 'SUPER_ADMIN') {
            delete req.body.role;
        }

        await user.update(req.body);

        await logActivity(req.user.id, 'UPDATE', 'USER', user.id, `Updated user: ${user.name}`);

        const userData = user.toJSON();
        delete userData.password;

        res.status(200).json({
            success: true,
            user: userData
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: Delete user
 *     tags: [Users]
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
 *         description: User deleted
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
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
const deleteUser = async (req, res, next) => {
    try {
        const user = await User.findByPk(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (req.user.role !== 'SUPER_ADMIN' && user.building_id !== req.user.building_id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to delete this user'
            });
        }

        if (user.id === req.user.id) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete your own account'
            });
        }

        await logActivity(req.user.id, 'DELETE', 'USER', user.id, `Deleted user: ${user.name}`);
        await user.destroy();

        res.status(200).json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser
};