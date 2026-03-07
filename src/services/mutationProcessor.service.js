const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const {
    getEntityConfig,
    normalizeEntity,
    sanitizePatch,
    canWriteEntity,
    canModifyRecord
} = require('./syncEntityRegistry.service');
const { buildConflictResult, hasVersionConflict } = require('./conflictHandler.service');
const { getByMutationIds, createMutationLog } = require('./mutationLogStorage.service');

const VALID_OPERATIONS = new Set(['create', 'update', 'delete']);

const normalizeMutation = (mutation = {}) => ({
    mutation_id: String(mutation.mutation_id || '').trim(),
    entity: normalizeEntity(mutation.entity),
    entity_id: mutation.entity_id != null ? Number(mutation.entity_id) : null,
    operation: String(mutation.operation || '').trim().toLowerCase(),
    patch: mutation.patch && typeof mutation.patch === 'object' ? mutation.patch : {},
    base_version: Number(mutation.base_version || 0),
    timestamp: mutation.timestamp || null
});

const isValidMutation = (mutation) => {
    if (!mutation.mutation_id) return false;
    if (!VALID_OPERATIONS.has(mutation.operation)) return false;
    if (!getEntityConfig(mutation.entity)) return false;
    if (mutation.operation !== 'create' && (!mutation.entity_id || !Number.isFinite(mutation.entity_id))) return false;
    return true;
};

const keyFor = (entity, entityId) => `${entity}:${entityId}`;

const prefetchRecords = async (mutations, user) => {
    const groupedByEntity = new Map();

    for (const mutation of mutations) {
        if (mutation.operation === 'create' || !mutation.entity_id) continue;
        const entity = mutation.entity;
        if (!groupedByEntity.has(entity)) groupedByEntity.set(entity, new Set());
        groupedByEntity.get(entity).add(mutation.entity_id);
    }

    const cache = new Map();
    const preloadTasks = [];

    for (const [entity, idsSet] of groupedByEntity.entries()) {
        const config = getEntityConfig(entity);
        if (!config) continue;
        const ids = [...idsSet];
        preloadTasks.push(
            config.model.findAll({ where: { id: { [Op.in]: ids } } })
                .then((rows) => {
                    rows.forEach((row) => {
                        cache.set(keyFor(entity, row.id), row);
                    });
                })
        );
    }

    await Promise.all(preloadTasks);

    return cache;
};

const toPlainRecord = (row) => {
    if (!row) return null;
    const payload = row.toJSON();
    delete payload.password;
    return payload;
};

const processOneMutation = async ({
    mutation,
    user,
    deviceId,
    recordCache,
    transaction
}) => {
    if (!isValidMutation(mutation)) {
        return {
            mutation_id: mutation.mutation_id || null,
            status: 'failed',
            message: 'Invalid mutation payload'
        };
    }

    if (!canWriteEntity(user, mutation.entity)) {
        return {
            mutation_id: mutation.mutation_id,
            status: 'failed',
            message: 'Not authorized for this entity'
        };
    }

    const config = getEntityConfig(mutation.entity);
    let record = mutation.entity_id ? recordCache.get(keyFor(mutation.entity, mutation.entity_id)) : null;

    if (mutation.operation !== 'create' && !record) {
        return {
            mutation_id: mutation.mutation_id,
            status: 'failed',
            message: 'Record not found'
        };
    }

    const allowedToModify = await canModifyRecord(user, mutation.entity, record, mutation.operation, mutation.patch);
    if (!allowedToModify) {
        return {
            mutation_id: mutation.mutation_id,
            status: 'failed',
            message: 'Forbidden mutation for current user'
        };
    }

    if (mutation.operation !== 'create' && hasVersionConflict({ baseVersion: mutation.base_version, record })) {
        return buildConflictResult({
            mutation,
            record: toPlainRecord(record)
        });
    }

    const sanitizedPatch = sanitizePatch(mutation.entity, mutation.patch);

    if (mutation.operation === 'create') {
        sanitizedPatch.version = 1;
        sanitizedPatch.deleted_at = null;

        if (mutation.entity === 'tasks' && user.role === 'TECHNICIAN') {
            sanitizedPatch.assigned_to = user.id;
        }
        if (mutation.entity === 'activities' && user.role !== 'SUPER_ADMIN') {
            sanitizedPatch.user_id = user.id;
        }

        const created = await config.model.create(sanitizedPatch, { transaction });
        const createdData = toPlainRecord(created);

        return {
            mutation_id: mutation.mutation_id,
            status: 'success',
            server_version: created.version,
            server_data: createdData
        };
    }

    if (mutation.operation === 'delete') {
        await record.update({
            deleted_at: new Date(),
            version: (Number(record.version) || 0) + 1
        }, { transaction, silent: false });
        await record.reload({ transaction });

        const deletedData = toPlainRecord(record);
        return {
            mutation_id: mutation.mutation_id,
            status: 'success',
            server_version: record.version,
            server_data: deletedData
        };
    }

    sanitizedPatch.deleted_at = null;
    sanitizedPatch.version = (Number(record.version) || 0) + 1;
    await record.update(sanitizedPatch, { transaction, silent: false });
    await record.reload({ transaction });

    const updatedData = toPlainRecord(record);
    return {
        mutation_id: mutation.mutation_id,
        status: 'success',
        server_version: record.version,
        server_data: updatedData
    };
};

const processMutationBatch = async ({ mutations = [], user, deviceId }) => {
    const normalized = Array.isArray(mutations) ? mutations.map(normalizeMutation) : [];
    const mutationIds = normalized.map((m) => m.mutation_id).filter(Boolean);
    const existingLogs = await getByMutationIds(mutationIds);
    const recordCache = await prefetchRecords(normalized, user);

    const results = [];
    for (const mutation of normalized) {
        if (!mutation.mutation_id) {
            results.push({
                mutation_id: null,
                status: 'failed',
                message: 'mutation_id is required'
            });
            continue;
        }

        const logged = existingLogs.get(mutation.mutation_id);
        if (logged) {
            results.push(logged.result_payload || {
                mutation_id: mutation.mutation_id,
                status: logged.status,
                server_version: null,
                server_data: null
            });
            continue;
        }

        const transaction = await sequelize.transaction();
        try {
            const outcome = await processOneMutation({
                mutation,
                user,
                deviceId,
                recordCache,
                transaction
            });

            await createMutationLog({
                mutationId: mutation.mutation_id,
                userId: user.id,
                deviceId,
                entity: mutation.entity,
                entityId: mutation.entity_id,
                operation: mutation.operation,
                status: outcome.status,
                resultPayload: outcome,
                transaction
            });

            await transaction.commit();
            results.push(outcome);

            if (outcome.status === 'success' && outcome.server_data?.id) {
                const config = getEntityConfig(mutation.entity);
                if (config) {
                    const fresh = await config.model.findByPk(outcome.server_data.id);
                    if (fresh) {
                        recordCache.set(keyFor(mutation.entity, fresh.id), fresh);
                    }
                }
            }
        } catch (error) {
            await transaction.rollback();

            if (error.name === 'SequelizeUniqueConstraintError') {
                const replay = await getByMutationIds([mutation.mutation_id]);
                const replayLog = replay.get(mutation.mutation_id);
                if (replayLog?.result_payload) {
                    results.push(replayLog.result_payload);
                    continue;
                }
            }

            const failed = {
                mutation_id: mutation.mutation_id,
                status: 'failed',
                message: error.message || 'Mutation processing failed'
            };
            results.push(failed);
        }
    }

    return results;
};

module.exports = {
    processMutationBatch
};
