const { Op } = require('sequelize');
const {
    User,
    Building,
    Equipment,
    EquipmentList,
    Task,
    ActivityLog
} = require('../models');

const entityRegistry = {
    users: {
        model: User,
        table: 'users',
        fields: ['name', 'email', 'password', 'role', 'building_id', 'is_active']
    },
    buildings: {
        model: Building,
        table: 'buildings',
        fields: ['name', 'location', 'description', 'status']
    },
    equipment: {
        model: Equipment,
        table: 'equipment',
        fields: ['building_id', 'name', 'status']
    },
    equipment_list: {
        model: EquipmentList,
        table: 'equipment_list',
        fields: [
            'equipment_id',
            'user_id',
            'asset_reference_number',
            'equipment_classification',
            'site_location',
            'vertical_ref_floor',
            'zone_context',
            'additional_notes',
            'image'
        ]
    },
    tasks: {
        model: Task,
        table: 'tasks',
        fields: ['equipment_id', 'assigned_to', 'priority', 'status', 'description', 'due_date', 'completed_at']
    },
    activities: {
        model: ActivityLog,
        table: 'activity_logs',
        fields: ['user_id', 'action_type', 'entity_type', 'entity_id', 'description']
    }
};

const normalizeEntity = (entity) => String(entity || '').trim().toLowerCase();

const getEntityConfig = (entity) => entityRegistry[normalizeEntity(entity)] || null;

const sanitizePatch = (entity, patch = {}) => {
    const config = getEntityConfig(entity);
    if (!config) return {};

    const safePatch = {};
    for (const field of config.fields) {
        if (Object.prototype.hasOwnProperty.call(patch, field)) {
            safePatch[field] = patch[field];
        }
    }
    return safePatch;
};

const canReadEntity = (user, entity) => {
    const role = user?.role;
    const normalized = normalizeEntity(entity);

    if (role === 'SUPER_ADMIN') return true;
    if (role === 'MANAGER') return ['users', 'buildings', 'equipment', 'equipment_list', 'tasks', 'activities'].includes(normalized);
    if (role === 'TECHNICIAN') return ['tasks', 'activities', 'users', 'equipment', 'buildings', 'equipment_list'].includes(normalized);
    return false;
};

const canWriteEntity = (user, entity) => {
    const role = user?.role;
    const normalized = normalizeEntity(entity);

    if (role === 'SUPER_ADMIN') return true;
    if (role === 'MANAGER') return ['users', 'buildings', 'equipment', 'equipment_list', 'tasks', 'activities'].includes(normalized);
    if (role === 'TECHNICIAN') return ['tasks', 'activities'].includes(normalized);
    return false;
};

const applyReadScope = async (user, entity, options = {}) => {
    const config = getEntityConfig(entity);
    if (!config) return options;
    if (user.role === 'SUPER_ADMIN') return options;

    const normalized = normalizeEntity(entity);
    const where = options.where || {};

    if (normalized === 'users') {
        where.building_id = user.building_id;
    }

    if (normalized === 'buildings') {
        where.id = user.building_id;
    }

    if (normalized === 'equipment') {
        where.building_id = user.building_id;
    }

    if (normalized === 'tasks') {
        if (user.role === 'TECHNICIAN') {
            where.assigned_to = user.id;
        }
    }

    if (normalized === 'activities') {
        if (user.role === 'TECHNICIAN') {
            where.user_id = user.id;
        }
        if (user.role === 'MANAGER') {
            const scopedUsers = await User.findAll({
                where: { building_id: user.building_id },
                attributes: ['id']
            });
            const userIds = scopedUsers.map((row) => row.id);
            where.user_id = { [Op.in]: userIds.length ? userIds : [0] };
        }
    }

    if (normalized === 'equipment_list') {
        const equipmentRows = await Equipment.findAll({
            where: { building_id: user.building_id },
            attributes: ['id']
        });
        const equipmentIds = equipmentRows.map((row) => row.id);
        where.equipment_id = { [Op.in]: equipmentIds.length ? equipmentIds : [0] };
    }

    options.where = where;
    return options;
};

const canModifyRecord = async (user, entity, record, operation, patch = {}) => {
    const normalized = normalizeEntity(entity);

    if (user.role === 'SUPER_ADMIN') return true;
    if (!record && operation === 'create') {
        if (normalized === 'equipment') {
            return Number(patch.building_id) === Number(user.building_id);
        }
        if (normalized === 'equipment_list') {
            const equipment = await Equipment.findByPk(Number(patch.equipment_id), { attributes: ['building_id'] });
            return Number(equipment?.building_id) === Number(user.building_id);
        }
        if (normalized === 'tasks') {
            const equipment = await Equipment.findByPk(Number(patch.equipment_id), { attributes: ['building_id'] });
            const sameBuilding = Number(equipment?.building_id) === Number(user.building_id);
            if (!sameBuilding) return false;
        }
        if (normalized === 'activities') {
            return Number(patch.user_id || user.id) === Number(user.id);
        }
        if (normalized === 'tasks' && user.role === 'TECHNICIAN') {
            return Number(patch.assigned_to || user.id) === Number(user.id);
        }
        if (normalized === 'users' && user.role !== 'SUPER_ADMIN') {
            return false;
        }
        return true;
    }

    if (!record) return false;

    if (normalized === 'users') {
        return Number(record.id) === Number(user.id) || (user.role === 'MANAGER' && Number(record.building_id) === Number(user.building_id));
    }

    if (normalized === 'buildings') {
        return user.role === 'MANAGER' && Number(record.id) === Number(user.building_id);
    }

    if (normalized === 'equipment') {
        return Number(record.building_id) === Number(user.building_id);
    }

    if (normalized === 'equipment_list') {
        const equipment = await Equipment.findByPk(record.equipment_id, { attributes: ['building_id'] });
        return Number(equipment?.building_id) === Number(user.building_id);
    }

    if (normalized === 'tasks') {
        if (user.role === 'TECHNICIAN') {
            return Number(record.assigned_to) === Number(user.id);
        }
        if (user.role === 'MANAGER') {
            const equipment = await Equipment.findByPk(record.equipment_id, { attributes: ['building_id'] });
            return Number(equipment?.building_id) === Number(user.building_id);
        }
    }

    if (normalized === 'activities') {
        if (user.role === 'TECHNICIAN') {
            return Number(record.user_id) === Number(user.id);
        }
        if (user.role === 'MANAGER') {
            const activityUser = await User.findByPk(record.user_id, { attributes: ['building_id'] });
            return Number(activityUser?.building_id) === Number(user.building_id);
        }
    }

    return false;
};

module.exports = {
    getEntityConfig,
    normalizeEntity,
    sanitizePatch,
    canReadEntity,
    canWriteEntity,
    applyReadScope,
    canModifyRecord
};
