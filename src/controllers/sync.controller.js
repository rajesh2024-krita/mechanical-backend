const {
    ActivityLog,
    Building,
    Equipment,
    EquipmentList,
    Task,
    User
} = require('../models');
const { pushMutations: pushMutationsService, pullChanges: pullChangesService } = require('../services/sync.service');

const mapFrontendRoleToApi = (role = 'TECHNICIAN') => {
    const normalized = String(role || '').toUpperCase();
    if (normalized === 'ADMIN' || normalized === 'SUPER_ADMIN') return 'SUPER_ADMIN';
    if (normalized === 'MANAGER') return 'MANAGER';
    return 'TECHNICIAN';
};

const mapFrontendEquipmentStatusToApi = (status = 'OPERATIONAL') => {
    const normalized = String(status || '').toUpperCase();
    if (normalized === 'DOWN' || normalized === 'INACTIVE') return 'INACTIVE';
    if (normalized === 'MAINTENANCE' || normalized === 'REPAIR_NEEDED' || normalized === 'UNDER_MAINTENANCE') {
        return 'UNDER_MAINTENANCE';
    }
    return 'ACTIVE';
};

const canSyncTable = (role, tableName) => {
    if (role === 'SUPER_ADMIN') return true;
    if (role === 'MANAGER') return ['users', 'buildings', 'equipment', 'tasks', 'activities'].includes(tableName);
    if (role === 'TECHNICIAN') return ['tasks', 'activities'].includes(tableName);
    return false;
};

const isPayloadNewer = (incomingUpdatedAt, currentUpdatedAt) => {
    if (!incomingUpdatedAt || !currentUpdatedAt) return true;
    return new Date(incomingUpdatedAt).getTime() >= new Date(currentUpdatedAt).getTime();
};

const upsertBuilding = async (payload, currentUser) => {
    if (currentUser.role === 'TECHNICIAN') {
        throw new Error('Technicians cannot modify buildings');
    }

    const id = Number(payload.id);
    const body = {
        name: String(payload.name || '').trim(),
        location: payload.location || '',
        description: payload.description || null,
        status: payload.status || 'ACTIVE'
    };

    if (id && Number.isFinite(id)) {
        const existing = await Building.findByPk(id);
        if (existing) {
            await existing.update(body);
            return { real_id: existing.id };
        }
    }

    const created = await Building.create(body);
    return { real_id: created.id };
};

const upsertUser = async (payload, currentUser) => {
    const id = Number(payload.id);
    const requestedRole = mapFrontendRoleToApi(payload.role);
    const body = {
        name: String(payload.fullName || `${payload.firstName || ''} ${payload.lastName || ''}` || payload.name || '').trim(),
        email: String(payload.username || payload.email || '').trim().toLowerCase(),
        password: String(payload.password || 'ChangeMe@123'),
        role: currentUser.role === 'SUPER_ADMIN' ? requestedRole : 'TECHNICIAN',
        building_id: currentUser.role === 'SUPER_ADMIN'
            ? (payload.assignedBuildingIds?.[0] || payload.building_id || null)
            : currentUser.building_id,
        is_active: payload.is_active !== false
    };

    if (id && Number.isFinite(id)) {
        const existing = await User.findByPk(id);
        if (existing) {
            const updateBody = { ...body };
            if (!payload.password) {
                delete updateBody.password;
            }
            await existing.update(updateBody);
            return { real_id: existing.id };
        }
    }

    const created = await User.create(body);
    return { real_id: created.id };
};

const upsertEquipment = async (payload, currentUser) => {
    const id = Number(payload.id);
    if (currentUser.role === 'TECHNICIAN') {
        throw new Error('Technicians cannot modify equipment');
    }

    const buildingId = Number(
        currentUser.role === 'SUPER_ADMIN'
            ? (payload.buildingId || payload.building_id || currentUser.building_id)
            : currentUser.building_id
    );
    const body = {
        building_id: buildingId,
        name: String(payload.name || '').trim(),
        status: mapFrontendEquipmentStatusToApi(payload.status)
    };

    if (id && Number.isFinite(id)) {
        const existing = await Equipment.findByPk(id);
        if (existing) {
            await existing.update(body);
            return { real_id: existing.id };
        }
    }

    const created = await Equipment.create(body);
    return { real_id: created.id };
};

const upsertEquipmentList = async (payload, equipmentId, currentUser) => {
    const listPayload = payload.list_payload || payload;
    const existing = await EquipmentList.findOne({
        where: { equipment_id: equipmentId },
        order: [['updated_at', 'DESC'], ['id', 'DESC']]
    });

    const body = {
        equipment_id: equipmentId,
        user_id: Number(listPayload.user_id || currentUser.id),
        asset_reference_number: listPayload.asset_reference_number || payload.refNumber || null,
        equipment_classification: listPayload.equipment_classification || payload.type || null,
        site_location: listPayload.site_location || payload.location || null,
        vertical_ref_floor: listPayload.vertical_ref_floor || payload.floorReference || null,
        zone_context: listPayload.zone_context || payload.areaZoneServed || null,
        additional_notes: listPayload.additional_notes || payload.notes || null,
        image: listPayload.image || payload.photos?.[0] || null
    };

    if (existing) {
        await existing.update(body);
        return;
    }
    await EquipmentList.create(body);
};

const upsertTask = async (payload, currentUser) => {
    const id = Number(payload.id);
    const body = {
        equipment_id: Number(payload.equipmentId || payload.equipment_id),
        assigned_to: currentUser.role === 'TECHNICIAN'
            ? currentUser.id
            : (payload.assignedTo || payload.assigned_to || currentUser.id),
        priority: payload.priority || 'MEDIUM',
        status: payload.status || 'PENDING',
        description: String(payload.description || payload.title || '').trim(),
        due_date: payload.dueDate || payload.due_date || null,
        completed_at: payload.status === 'COMPLETED' ? new Date() : null
    };

    if (id && Number.isFinite(id)) {
        const existing = await Task.findByPk(id);
        if (existing) {
            await existing.update(body);
            return { real_id: existing.id };
        }
    }

    const created = await Task.create(body);
    return { real_id: created.id };
};

const createActivity = async (payload, currentUser) => {
    const row = await ActivityLog.create({
        user_id: Number(payload.userId || payload.user_id || currentUser.id),
        action_type: String(payload.action || payload.action_type || 'UPDATE').toUpperCase(),
        entity_type: String(payload.entityType || payload.entity_type || 'TASK').toUpperCase(),
        entity_id: Number(payload.entityId || payload.entity_id || 0) || null,
        description: String(payload.details || payload.description || '').trim()
    });
    return { real_id: row.id };
};

const deleteRow = async (tableName, id) => {
    const numericId = Number(id);
    if (!numericId || !Number.isFinite(numericId)) return;

    if (tableName === 'buildings') await Building.destroy({ where: { id: numericId } });
    if (tableName === 'users') await User.destroy({ where: { id: numericId } });
    if (tableName === 'equipment') await Equipment.destroy({ where: { id: numericId } });
    if (tableName === 'tasks') await Task.destroy({ where: { id: numericId } });
};

const syncBatch = async (req, res, next) => {
    try {
        const items = Array.isArray(req.body) ? req.body : [];
        const results = [];

        for (const item of items) {
            const tableName = String(item.table_name || '').toLowerCase();
            const action = String(item.action_type || '').toLowerCase();
            const payload = item.payload || {};

            if (!canSyncTable(req.user.role, tableName)) {
                results.push({
                    temp_id: item.temp_id,
                    status: 'failed',
                    message: 'Not authorized for this sync operation'
                });
                continue;
            }

            try {
                if (action === 'delete') {
                    await deleteRow(tableName, payload.id);
                    results.push({ temp_id: item.temp_id, status: 'success', real_id: null });
                    continue;
                }

                // Last-write-wins: compare queue item updated_at with current row updated_at.
                if (action === 'update' && payload.id && Number(payload.id)) {
                    let existing = null;
                    if (tableName === 'buildings') existing = await Building.findByPk(payload.id);
                    if (tableName === 'users') existing = await User.findByPk(payload.id);
                    if (tableName === 'equipment') existing = await Equipment.findByPk(payload.id);
                    if (tableName === 'tasks') existing = await Task.findByPk(payload.id);
                    if (existing && !isPayloadNewer(item.updated_at, existing.updated_at)) {
                        results.push({
                            temp_id: item.temp_id,
                            status: 'success',
                            real_id: existing.id,
                            message: 'Skipped older update (conflict handled by last-write-wins)'
                        });
                        continue;
                    }
                }

                if (tableName === 'buildings') {
                    const row = await upsertBuilding(payload, req.user);
                    results.push({ temp_id: item.temp_id, status: 'success', real_id: row.real_id });
                    continue;
                }

                if (tableName === 'users') {
                    const row = await upsertUser(payload, req.user);
                    results.push({ temp_id: item.temp_id, status: 'success', real_id: row.real_id });
                    continue;
                }

                if (tableName === 'equipment') {
                    const row = await upsertEquipment(payload, req.user);
                    await upsertEquipmentList(payload, row.real_id, req.user);
                    results.push({ temp_id: item.temp_id, status: 'success', real_id: row.real_id });
                    continue;
                }

                if (tableName === 'tasks') {
                    const row = await upsertTask(payload, req.user);
                    results.push({ temp_id: item.temp_id, status: 'success', real_id: row.real_id });
                    continue;
                }

                if (tableName === 'activities') {
                    const row = await createActivity(payload, req.user);
                    results.push({ temp_id: item.temp_id, status: 'success', real_id: row.real_id });
                    continue;
                }

                results.push({
                    temp_id: item.temp_id,
                    status: 'failed',
                    message: `Unsupported table: ${tableName}`
                });
            } catch (err) {
                results.push({
                    temp_id: item.temp_id,
                    status: 'failed',
                    message: err.message || 'Sync operation failed'
                });
            }
        }

        return res.status(200).json(results);
    } catch (error) {
        return next(error);
    }
};

const validatePushRequest = (body) => {
    if (!body || typeof body !== 'object') {
        return 'Invalid request payload';
    }

    if (!Array.isArray(body.mutations)) {
        return '`mutations` must be an array';
    }

    if (body.mutations.length > Number(process.env.SYNC_MAX_MUTATIONS_PER_PUSH || 500)) {
        return 'Mutation batch exceeds maximum allowed size';
    }

    return null;
};

const pushMutations = async (req, res, next) => {
    try {
        const validationError = validatePushRequest(req.body);
        if (validationError) {
            return res.status(400).json({
                success: false,
                message: validationError
            });
        }

        const payload = await pushMutationsService({
            user: req.user,
            deviceId: req.headers['x-device-id'] || req.body.device_id || null,
            mutations: req.body.mutations
        });

        return res.status(200).json({
            success: true,
            ...payload
        });
    } catch (error) {
        return next(error);
    }
};

const pullChanges = async (req, res, next) => {
    try {
        const payload = await pullChangesService({
            user: req.user,
            cursor: req.query.cursor
        });

        return res.status(200).json({
            success: true,
            ...payload
        });
    } catch (error) {
        return next(error);
    }
};

module.exports = { syncBatch, pushMutations, pullChanges };
