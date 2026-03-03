const User = require('./User');
const Building = require('./Building');
const Equipment = require('./Equipment');
const EquipmentList = require('./EquipmentList');
const EquipmentChecklistTemplate = require('./EquipmentChecklistTemplate');
const Task = require('./Task');
const TaskChecklist = require('./TaskChecklist');
const ActivityLog = require('./ActivityLog');
const SyncLog = require('./SyncLog');

// Define associations
User.belongsTo(Building, { foreignKey: 'building_id', as: 'building' });
Building.hasMany(User, { foreignKey: 'building_id', as: 'users' });

Equipment.belongsTo(Building, { foreignKey: 'building_id', as: 'building' });
Building.hasMany(Equipment, { foreignKey: 'building_id', as: 'equipment' });

EquipmentList.belongsTo(Equipment, { foreignKey: 'equipment_id', as: 'equipment' });
Equipment.hasMany(EquipmentList, { foreignKey: 'equipment_id', as: 'equipmentList' });

EquipmentList.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(EquipmentList, { foreignKey: 'user_id', as: 'equipmentListEntries' });

Task.belongsTo(Equipment, { foreignKey: 'equipment_id', as: 'equipment' });
Equipment.hasMany(Task, { foreignKey: 'equipment_id', as: 'tasks' });

Task.belongsTo(User, { foreignKey: 'assigned_to', as: 'assignee' });
User.hasMany(Task, { foreignKey: 'assigned_to', as: 'assignedTasks' });

TaskChecklist.belongsTo(Task, { foreignKey: 'task_id', as: 'task' });
Task.hasMany(TaskChecklist, { foreignKey: 'task_id', as: 'checklistItems' });

TaskChecklist.belongsTo(User, { foreignKey: 'updated_by', as: 'updatedBy' });
User.hasMany(TaskChecklist, { foreignKey: 'updated_by', as: 'updatedChecklistItems' });

ActivityLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(ActivityLog, { foreignKey: 'user_id', as: 'activities' });

module.exports = {
    User,
    Building,
    Equipment,
    EquipmentList,
    EquipmentChecklistTemplate,
    Task,
    TaskChecklist,
    ActivityLog,
    SyncLog
};
