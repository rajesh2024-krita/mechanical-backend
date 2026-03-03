const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/database');
const User = require('../models/User');

const createAdminUser = async () => {
    try {
        await sequelize.authenticate();
        console.log('Database connected');

        // Check if admin already exists
        const existingAdmin = await User.findOne({ 
            where: { email: 'admin@system.com' } 
        });

        if (existingAdmin) {
            console.log('Admin user already exists');
            process.exit(0);
        }

        // Create admin user with proper password hashing
        const hashedPassword = await bcrypt.hash('Admin@123', 10);
        
        const admin = await User.create({
            name: 'Super Admin',
            email: 'admin@system.com',
            password: hashedPassword,
            role: 'SUPER_ADMIN',
            is_active: true
        });

        console.log('Admin user created successfully:');
        console.log('Email: admin@system.com');
        console.log('Password: Admin@123');
        console.log('Role: SUPER_ADMIN');
        
    } catch (error) {
        console.error('Error creating admin user:', error);
    } finally {
        await sequelize.close();
        process.exit();
    }
};

createAdminUser();