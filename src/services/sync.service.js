const { Op } = require('sequelize');
const { processMutationBatch } = require('./mutationProcessor.service');
const {
    getEntityConfig,
    canReadEntity,
    applyReadScope
} = require('./syncEntityRegistry.service');

const DEFAULT_PULL_LIMIT = Number(process.env.SYNC_PULL_LIMIT || 500);

const parseCursor = (cursor) => {
    if (!cursor) return new Date(0);

    const asNumber = Number(cursor);
    if (Number.isFinite(asNumber) && String(cursor).trim() !== '') {
        return new Date(asNumber);
    }

    const asDate = new Date(cursor);
    if (!Number.isNaN(asDate.getTime())) return asDate;
    return new Date(0);
};

const buildChangedAt = (row) => {
    const updatedAt = row.updated_at ? new Date(row.updated_at).getTime() : 0;
    const deletedAt = row.deleted_at ? new Date(row.deleted_at).getTime() : 0;
    return Math.max(updatedAt, deletedAt, 0);
};

const sanitizeRow = (row) => {
    const payload = row.toJSON();
    delete payload.password;
    return payload;
};

const fetchEntityChanges = async ({ entity, user, since, limitPerEntity }) => {
    const config = getEntityConfig(entity);
    if (!config || !canReadEntity(user, entity)) return [];

    const options = await applyReadScope(user, entity, {
        where: {
            [Op.or]: [
                { updated_at: { [Op.gt]: since } },
                { deleted_at: { [Op.gt]: since } }
            ]
        },
        order: [['updated_at', 'ASC'], ['id', 'ASC']],
        limit: limitPerEntity
    });

    const rows = await config.model.findAll(options);
    return rows.map((row) => ({
        entity,
        entity_id: row.id,
        version: row.version || 0,
        updated_at: row.updated_at || null,
        deleted_at: row.deleted_at || null,
        data: sanitizeRow(row),
        changed_at_ms: buildChangedAt(row)
    }));
};

const pullChanges = async ({ user, cursor }) => {
    const since = parseCursor(cursor);
    const entities = ['users', 'buildings', 'equipment', 'equipment_list', 'tasks', 'activities'];
    const perEntityLimit = Math.max(50, Math.ceil(DEFAULT_PULL_LIMIT / entities.length));

    const grouped = await Promise.all(
        entities.map((entity) => fetchEntityChanges({
            entity,
            user,
            since,
            limitPerEntity: perEntityLimit
        }))
    );

    const changes = grouped.flat().sort((a, b) => {
        if (a.changed_at_ms === b.changed_at_ms) {
            return String(a.entity).localeCompare(String(b.entity));
        }
        return a.changed_at_ms - b.changed_at_ms;
    }).slice(0, DEFAULT_PULL_LIMIT);

    const maxChangedAt = changes.reduce((max, item) => Math.max(max, item.changed_at_ms || 0), since.getTime());

    return {
        changes: changes.map(({ changed_at_ms, ...item }) => item),
        next_cursor: String(maxChangedAt)
    };
};

const pushMutations = async ({ user, deviceId, mutations }) => {
    const results = await processMutationBatch({
        mutations,
        user,
        deviceId
    });

    return { results };
};

module.exports = {
    pushMutations,
    pullChanges
};
