const buildConflictResult = ({ mutation, record }) => ({
    mutation_id: mutation.mutation_id,
    status: 'conflict',
    server_version: record?.version || 0,
    server_data: record || null
});

const hasVersionConflict = ({ baseVersion, record }) => {
    if (!record) return false;
    const currentVersion = Number(record.version || 0);
    const incomingVersion = Number(baseVersion || 0);
    return currentVersion !== incomingVersion;
};

module.exports = {
    buildConflictResult,
    hasVersionConflict
};
