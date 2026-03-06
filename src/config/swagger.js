const swaggerJsdoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Maintenance Management System API',
            version: '1.0.0',
            description: 'API documentation for Mechanical Maintenance Management System',
            contact: {
                name: 'API Support',
                email: 'support@example.com'
            }
        },
        servers: [
            {
                url: 'https://api.msengineers.net.au/api',
                description: 'Production Server'
            }   
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT'
                }
            },
            schemas: {
                User: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', example: 1 },
                        name: { type: 'string', example: 'John Doe' },
                        email: { type: 'string', format: 'email', example: 'john@example.com' },
                        role: { type: 'string', enum: ['SUPER_ADMIN', 'MANAGER', 'TECHNICIAN'], example: 'TECHNICIAN' },
                        building_id: { type: 'integer', nullable: true, example: 1 },
                        is_active: { type: 'boolean', example: true },
                        created_at: { type: 'string', format: 'date-time' }
                    }
                },
                Building: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', example: 1 },
                        name: { type: 'string', example: 'Main Building' },
                        location: { type: 'string', example: '123 Main St, City' },
                        description: { type: 'string', example: 'Headquarters' },
                        created_at: { type: 'string', format: 'date-time' }
                    }
                },
                Equipment: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', example: 1 },
                        building_id: { type: 'integer', example: 1 },
                        name: { type: 'string', example: 'HVAC System' },
                        status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'UNDER_MAINTENANCE'], example: 'ACTIVE' },
                        created_at: { type: 'string', format: 'date-time' },
                        updated_at: { type: 'string', format: 'date-time' }
                    }
                },
                EquipmentList: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', example: 1 },
                        equipment_id: { type: 'integer', example: 10 },
                        user_id: { type: 'integer', example: 3 },
                        asset_reference_number: { type: 'string', example: 'AR-0001' },
                        equipment_classification: { type: 'string', example: 'Chiller' },
                        site_location: { type: 'string', example: 'Main Building' },
                        vertical_ref_floor: { type: 'string', example: 'Floor 1' },
                        zone_context: { type: 'string', example: 'Zone A' },
                        additional_notes: { type: 'string', example: 'Routine audit note' },
                        image: { type: 'string', example: '/uploads/equipment-123.jpg' },
                        created_at: { type: 'string', format: 'date-time' },
                        updated_at: { type: 'string', format: 'date-time' }
                    }
                },
                Task: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', example: 1 },
                        equipment_id: { type: 'integer', example: 1 },
                        assigned_to: { type: 'integer', nullable: true, example: 3 },
                        priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'], example: 'HIGH' },
                        status: { type: 'string', enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED'], example: 'PENDING' },
                        description: { type: 'string', example: 'Perform routine maintenance on HVAC system' },
                        due_date: { type: 'string', format: 'date', example: '2024-03-01' },
                        completed_at: { type: 'string', format: 'date-time', nullable: true }
                    }
                },
                ActivityLog: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', example: 1 },
                        user_id: { type: 'integer', example: 1 },
                        action_type: { type: 'string', example: 'CREATE' },
                        entity_type: { type: 'string', example: 'EQUIPMENT' },
                        entity_id: { type: 'integer', example: 1 },
                        description: { type: 'string', example: 'Created equipment: HVAC System' },
                        created_at: { type: 'string', format: 'date-time' }
                    }
                },
                Error: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: false },
                        message: { type: 'string', example: 'Error message' }
                    }
                },
                LoginRequest: {
                    type: 'object',
                    required: ['email', 'password'],
                    properties: {
                        email: { type: 'string', format: 'email', example: 'admin@system.com' },
                        password: { type: 'string', format: 'password', example: 'Admin@123' }
                    }
                },
                LoginResponse: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: true },
                        token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
                        user: { $ref: '#/components/schemas/User' }
                    }
                }
            }
        },
        security: [{
            bearerAuth: []
        }]
    },
    apis: ['./src/routes/*.js'] // Path to the API routes
};

const specs = swaggerJsdoc(options);
module.exports = specs;
