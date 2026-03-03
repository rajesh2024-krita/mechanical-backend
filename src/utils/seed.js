const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/database');
const { User, Building, Equipment, Task } = require('../models');
const { seedEquipmentChecklistTemplates } = require('./seedEquipmentChecklists');
const { EQUIPMENT_TYPE_OPTIONS } = require('../constants/equipment-checklists');

const seedDatabase = async () => {
    try {
        await seedEquipmentChecklistTemplates();

        // Clear tables
        await Task.destroy({ where: {}, force: true });
        await Equipment.destroy({ where: {}, force: true });
        await User.destroy({ where: {}, force: true });
        await Building.destroy({ where: {}, force: true });

        // Create buildings
        const building1 = await Building.create({
            name: 'Main Building',
            location: '123 Main St',
            description: 'Headquarters'
        });

        const building2 = await Building.create({
            name: 'North Wing',
            location: '456 North Ave',
            description: 'North facility'
        });

        // Create users
        const hashedPassword = await bcrypt.hash('password123', 10);

        const admin = await User.create({
            name: 'Super Admin',
            email: 'admin@example.com',
            password: hashedPassword,
            role: 'SUPER_ADMIN'
        });

        const buildingAdmin = await User.create({
            name: 'Building Admin',
            email: 'building.admin@example.com',
            password: hashedPassword,
            role: 'MANAGER',
            building_id: building1.id
        });

        const technician = await User.create({
            name: 'John Technician',
            email: 'technician@example.com',
            password: hashedPassword,
            role: 'TECHNICIAN',
            building_id: building1.id
        });

        const equipmentRecords = [];
        for (let i = 0; i < EQUIPMENT_TYPE_OPTIONS.length; i += 1) {
            const type = EQUIPMENT_TYPE_OPTIONS[i];
            const index = i + 1;
            const isEven = index % 2 === 0;

            const equipment = await Equipment.create({
                building_id: isEven ? building2.id : building1.id,
                name: type.label
            });

            equipmentRecords.push(equipment);
        }

        // Create tasks
        await Task.create({
            equipment_id: equipmentRecords[0].id,
            assigned_to: technician.id,
            priority: 'HIGH',
            description: 'Perform routine maintenance on HVAC system',
            due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
        });

        await Task.create({
            equipment_id: equipmentRecords[1].id,
            assigned_to: technician.id,
            priority: 'MEDIUM',
            description: 'Inspect elevator safety mechanisms',
            due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days from now
        });

        console.log('Database seeded successfully');
    } catch (error) {
        console.error('Error seeding database:', error);
    } finally {
        process.exit();
    }
};

// Run seeder if called directly
if (require.main === module) {
    seedDatabase();
}

module.exports = seedDatabase;
