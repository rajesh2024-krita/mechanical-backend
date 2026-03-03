const { ActivityLog } = require('../models');

const logActivity = async (userId, actionType, entityType, entityId, description) => {
    try {
        await ActivityLog.create({
            user_id: userId,
            action_type: actionType,
            entity_type: entityType,
            entity_id: entityId,
            description: description
        });
    } catch (error) {
        console.error('Error logging activity:', error);
    }
};

module.exports = { logActivity };