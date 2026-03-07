const { Op } = require('sequelize');
const { SyncMutationLog } = require('../models');

const getByMutationIds = async (mutationIds = []) => {
    if (!mutationIds.length) return new Map();

    const rows = await SyncMutationLog.findAll({
        where: { mutation_id: { [Op.in]: mutationIds } }
    });

    return rows.reduce((acc, row) => {
        acc.set(row.mutation_id, row);
        return acc;
    }, new Map());
};

const createMutationLog = async ({
    mutationId,
    userId,
    deviceId,
    entity,
    entityId,
    operation,
    status,
    resultPayload,
    transaction
}) => SyncMutationLog.create({
    mutation_id: mutationId,
    user_id: userId,
    device_id: deviceId || null,
    entity,
    entity_id: entityId || null,
    operation,
    status,
    result_payload: resultPayload
}, { transaction });

module.exports = {
    getByMutationIds,
    createMutationLog
};
