const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SYNC_ENTITY_TABLES = [
    'users',
    'buildings',
    'equipment',
    'equipment_list',
    'tasks',
    'activity_logs'
];

const hasIndex = (indexes, indexName) => indexes.some((idx) => idx.name === indexName);

const ensureColumnsForTable = async (queryInterface, tableName) => {
    const table = await queryInterface.describeTable(tableName);

    if (!table.updated_at) {
        await queryInterface.addColumn(tableName, 'updated_at', {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: sequelize.literal('CURRENT_TIMESTAMP')
        });
    }

    if (!table.version) {
        await queryInterface.addColumn(tableName, 'version', {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1
        });
    }

    if (!table.deleted_at) {
        await queryInterface.addColumn(tableName, 'deleted_at', {
            type: DataTypes.DATE,
            allowNull: true
        });
    }

    const indexes = await queryInterface.showIndex(tableName);

    if (!hasIndex(indexes, `idx_${tableName}_updated_at`)) {
        await queryInterface.addIndex(tableName, ['updated_at'], { name: `idx_${tableName}_updated_at` });
    }

    if (!hasIndex(indexes, `idx_${tableName}_deleted_at`)) {
        await queryInterface.addIndex(tableName, ['deleted_at'], { name: `idx_${tableName}_deleted_at` });
    }

    if (!hasIndex(indexes, `idx_${tableName}_version`)) {
        await queryInterface.addIndex(tableName, ['version'], { name: `idx_${tableName}_version` });
    }
};

const ensureSyncMutationLogTable = async (queryInterface) => {
    const allTables = await queryInterface.showAllTables();
    const tableNames = allTables.map((name) => (typeof name === 'string' ? name : name.tableName || name.table_name));
    const hasTable = tableNames.includes('sync_mutation_logs');

    if (!hasTable) {
        await queryInterface.createTable('sync_mutation_logs', {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },
            mutation_id: {
                type: DataTypes.STRING(191),
                allowNull: false,
                unique: true
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false
            },
            device_id: {
                type: DataTypes.STRING(100),
                allowNull: true
            },
            entity: {
                type: DataTypes.STRING(50),
                allowNull: false
            },
            entity_id: {
                type: DataTypes.INTEGER,
                allowNull: true
            },
            operation: {
                type: DataTypes.STRING(20),
                allowNull: false
            },
            status: {
                type: DataTypes.ENUM('success', 'conflict', 'failed'),
                allowNull: false
            },
            result_payload: {
                type: DataTypes.JSON,
                allowNull: true
            },
            processed_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: sequelize.literal('CURRENT_TIMESTAMP')
            },
            created_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: sequelize.literal('CURRENT_TIMESTAMP')
            }
        });
    }

    const indexes = await queryInterface.showIndex('sync_mutation_logs');
    if (!hasIndex(indexes, 'idx_sync_mutation_logs_mutation_id')) {
        await queryInterface.addIndex('sync_mutation_logs', ['mutation_id'], {
            unique: true,
            name: 'idx_sync_mutation_logs_mutation_id'
        });
    }
    if (!hasIndex(indexes, 'idx_sync_mutation_logs_user_device')) {
        await queryInterface.addIndex('sync_mutation_logs', ['user_id', 'device_id'], {
            name: 'idx_sync_mutation_logs_user_device'
        });
    }
    if (!hasIndex(indexes, 'idx_sync_mutation_logs_created_at')) {
        await queryInterface.addIndex('sync_mutation_logs', ['created_at'], {
            name: 'idx_sync_mutation_logs_created_at'
        });
    }
};

const ensureSyncSchemaCompatibility = async () => {
    const queryInterface = sequelize.getQueryInterface();

    for (const tableName of SYNC_ENTITY_TABLES) {
        await ensureColumnsForTable(queryInterface, tableName);
    }

    await ensureSyncMutationLogTable(queryInterface);
};

module.exports = {
    ensureSyncSchemaCompatibility
};
