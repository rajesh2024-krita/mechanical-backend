const { body, param, query, validationResult } = require('express-validator');

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }
    next();
};

const userValidation = {
    create: [
        body('name').notEmpty().withMessage('Name is required'),
        body('email').isEmail().withMessage('Valid email is required'),
        body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
        body('role').isIn(['SUPER_ADMIN', 'MANAGER', 'TECHNICIAN']).withMessage('Invalid role'),
        validate
    ],
    update: [
        body('name').optional().notEmpty(),
        body('email').optional().isEmail(),
        body('role').optional().isIn(['SUPER_ADMIN', 'MANAGER', 'TECHNICIAN']),
        validate
    ]
};

const buildingValidation = {
    create: [
        body('name').notEmpty().withMessage('Building name is required'),
        body('status').optional().isIn(['ACTIVE', 'INACTIVE']).withMessage('Invalid building status'),
        validate
    ],
    update: [
        body('name').optional().notEmpty(),
        body('status').optional().isIn(['ACTIVE', 'INACTIVE']).withMessage('Invalid building status'),
        validate
    ]
};

const equipmentValidation = {
    create: [
        body('building_id').isInt().withMessage('Valid building ID is required'),
        body('name').notEmpty().withMessage('Equipment name is required'),
        body('status').optional().isIn(['ACTIVE', 'INACTIVE', 'UNDER_MAINTENANCE']),
        validate
    ],
    update: [
        body('name').optional().notEmpty(),
        body('status').optional().isIn(['ACTIVE', 'INACTIVE', 'UNDER_MAINTENANCE']),
        validate
    ]
};

const taskValidation = {
    create: [
        body('equipment_id').isInt().withMessage('Valid equipment ID is required'),
        body('description').notEmpty().withMessage('Task description is required'),
        body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH']),
        validate
    ],
    update: [
        body('status').optional().isIn(['PENDING', 'IN_PROGRESS', 'COMPLETED']),
        body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH']),
        validate
    ]
};

module.exports = {
    validate,
    userValidation,
    buildingValidation,
    equipmentValidation,
    taskValidation
};
