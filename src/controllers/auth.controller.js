const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { logActivity } = require('../services/activity.service');

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE || '7d'
    });
};

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@system.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: Admin@123
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
const login = async (req, res, next) => {
    try {
        const email = String(req.body.email || '').trim().toLowerCase();
        const password = String(req.body.password || '');

        console.log('Login attempt for email:', email);

        // Validate email & password
        if (!email || !password) {
            console.log('Missing email or password');
            return res.status(400).json({
                success: false,
                message: 'Please provide email and password'
            });
        }

        // Check for user
        const user = await User.findOne({ 
            where: { email },
            include: ['building']
        });

        if (!user) {
            console.log('User not found:', email);
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        console.log('User found:', user.email, 'Role:', user.role);
        console.log('User is active:', user.is_active);

        // Check if user is active
        if (!user.is_active) {
            console.log('User is inactive:', email);
            return res.status(401).json({
                success: false,
                message: 'Your account is deactivated'
            });
        }

        // Check password
        console.log('Validating password...');
        const isPasswordValid = await user.validatePassword(password);
        console.log('Password valid:', isPasswordValid);

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Log activity
        await logActivity(user.id, 'LOGIN', 'USER', user.id, 'User logged in');

        // Generate token
        const token = generateToken(user.id);
        console.log('Token generated for user:', user.id);

        // Remove password from output
        const userData = user.toJSON();
        delete userData.password;

        res.status(200).json({
            success: true,
            token,
            user: userData
        });
    } catch (error) {
        console.error('Login error:', error);
        next(error);
    }
};

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get current user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user data
 *       401:
 *         description: Not authorized
 */
const getMe = async (req, res, next) => {
    try {
        const user = await User.findByPk(req.user.id, {
            attributes: { exclude: ['password'] },
            include: ['building']
        });

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
 * /auth/register:
 *   post:
 *     summary: Register new user (Super Admin only)
 *     tags: [Auth]
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
 *                 example: John Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john@example.com
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
 *       400:
 *         description: Validation error
 */
const register = async (req, res, next) => {
    try {
        const { name, email, password, role, building_id } = req.body;

        // Check if user exists
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User already exists with this email'
            });
        }

        // Create user
        const user = await User.create({
            name,
            email,
            password,
            role,
            building_id
        });

        // Log activity
        await logActivity(req.user.id, 'CREATE', 'USER', user.id, `Created user: ${user.name}`);

        // Remove password from output
        const userData = user.toJSON();
        delete userData.password;

        res.status(201).json({
            success: true,
            user: userData
        });
    } catch (error) {
        console.error('Registration error:', error);
        next(error);
    }
};

module.exports = {
    login,
    getMe,
    register
};
