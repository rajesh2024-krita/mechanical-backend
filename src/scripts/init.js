const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const {
    EQUIPMENT_CHECKLISTS,
    CHECKLIST_ITEM_TYPES
} = require('../constants/equipment-checklists');

dotenv.config();

const initDatabase = async () => {
    let connection;
    try {
        // First connect without database to create it if needed
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || ''
        });

        console.log('Connected to MySQL');

        // Create database if it doesn't exist
        await connection.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || 'maintenance_db'}`);
        console.log(`Database ${process.env.DB_NAME || 'maintenance_db'} created or already exists`);

        // Use the database
        await connection.query(`USE ${process.env.DB_NAME || 'maintenance_db'}`);

        // Create tables
        console.log('Creating tables...');

        // Users table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role ENUM('SUPER_ADMIN', 'MANAGER', 'TECHNICIAN') NOT NULL DEFAULT 'TECHNICIAN',
                building_id INT NULL,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_email (email),
                INDEX idx_role (role)
            )
        `);

        // Buildings table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS buildings (
                id INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(100) NOT NULL,
                location TEXT,
                description TEXT,
                status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        try {
            await connection.query(`
                ALTER TABLE buildings
                ADD COLUMN status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE' AFTER description
            `);
        } catch (alterError) {
            if (alterError.code !== 'ER_DUP_FIELDNAME') {
                throw alterError;
            }
        }

        // Equipment table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS equipment (
                id INT PRIMARY KEY AUTO_INCREMENT,
                building_id INT NOT NULL,
                name VARCHAR(100) NOT NULL,
                status ENUM('ACTIVE', 'INACTIVE', 'UNDER_MAINTENANCE') NOT NULL DEFAULT 'ACTIVE',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE
            )
        `);
        try {
            await connection.query(`
                ALTER TABLE equipment
                DROP COLUMN category
            `);
        } catch (alterError) {
            if (alterError.code !== 'ER_CANT_DROP_FIELD_OR_KEY') {
                throw alterError;
            }
        }
        try {
            await connection.query(`
                ALTER TABLE equipment
                DROP COLUMN asset_reference_number
            `);
        } catch (alterError) {
            if (alterError.code !== 'ER_CANT_DROP_FIELD_OR_KEY') {
                throw alterError;
            }
        }
        try {
            await connection.query(`
                ALTER TABLE equipment
                DROP COLUMN equipment_classification
            `);
        } catch (alterError) {
            if (alterError.code !== 'ER_CANT_DROP_FIELD_OR_KEY') {
                throw alterError;
            }
        }
        try {
            await connection.query(`
                ALTER TABLE equipment
                DROP COLUMN site_location
            `);
        } catch (alterError) {
            if (alterError.code !== 'ER_CANT_DROP_FIELD_OR_KEY') {
                throw alterError;
            }
        }
        try {
            await connection.query(`
                ALTER TABLE equipment
                DROP COLUMN vertical_ref_floor
            `);
        } catch (alterError) {
            if (alterError.code !== 'ER_CANT_DROP_FIELD_OR_KEY') {
                throw alterError;
            }
        }
        try {
            await connection.query(`
                ALTER TABLE equipment
                DROP COLUMN zone_context
            `);
        } catch (alterError) {
            if (alterError.code !== 'ER_CANT_DROP_FIELD_OR_KEY') {
                throw alterError;
            }
        }
        try {
            await connection.query(`
                ALTER TABLE equipment
                DROP COLUMN additional_notes
            `);
        } catch (alterError) {
            if (alterError.code !== 'ER_CANT_DROP_FIELD_OR_KEY') {
                throw alterError;
            }
        }
        try {
            await connection.query(`
                ALTER TABLE equipment
                DROP COLUMN equipment_type
            `);
        } catch (alterError) {
            if (alterError.code !== 'ER_CANT_DROP_FIELD_OR_KEY') {
                throw alterError;
            }
        }
        try {
            await connection.query(`
                ALTER TABLE equipment
                DROP COLUMN serial_number
            `);
        } catch (alterError) {
            if (alterError.code !== 'ER_CANT_DROP_FIELD_OR_KEY') {
                throw alterError;
            }
        }
        try {
            await connection.query(`
                ALTER TABLE equipment
                DROP COLUMN installation_date
            `);
        } catch (alterError) {
            if (alterError.code !== 'ER_CANT_DROP_FIELD_OR_KEY') {
                throw alterError;
            }
        }
        try {
            await connection.query(`
                ALTER TABLE equipment
                ADD COLUMN status ENUM('ACTIVE', 'INACTIVE', 'UNDER_MAINTENANCE') NOT NULL DEFAULT 'ACTIVE' AFTER name
            `);
        } catch (alterError) {
            if (alterError.code !== 'ER_DUP_FIELDNAME') {
                throw alterError;
            }
        }
        try {
            await connection.query(`
                ALTER TABLE equipment
                DROP COLUMN photo_url
            `);
        } catch (alterError) {
            if (alterError.code !== 'ER_CANT_DROP_FIELD_OR_KEY') {
                throw alterError;
            }
        }
        try {
            await connection.query(`
                ALTER TABLE equipment
                DROP COLUMN image
            `);
        } catch (alterError) {
            if (alterError.code !== 'ER_CANT_DROP_FIELD_OR_KEY') {
                throw alterError;
            }
        }
        try {
            await connection.query(`
                ALTER TABLE equipment
                DROP FOREIGN KEY equipment_ibfk_2
            `);
        } catch (alterError) {
            if (alterError.code !== 'ER_CANT_DROP_FIELD_OR_KEY' && alterError.code !== 'ER_DROP_INDEX_FK') {
                throw alterError;
            }
        }
        try {
            await connection.query(`
                ALTER TABLE equipment
                DROP COLUMN created_by
            `);
        } catch (alterError) {
            if (alterError.code !== 'ER_CANT_DROP_FIELD_OR_KEY') {
                throw alterError;
            }
        }

        // Equipment checklist templates table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS equipment_checklist_templates (
                id INT PRIMARY KEY AUTO_INCREMENT,
                equipment_type VARCHAR(100) NOT NULL,
                item_text TEXT NOT NULL,
                item_type ENUM('CHECKLIST', 'ADDON') NOT NULL DEFAULT 'CHECKLIST',
                sort_order INT NOT NULL DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_equipment_item (equipment_type, item_text(255), item_type),
                INDEX idx_equipment_type_sort (equipment_type, sort_order)
            )
        `);

        // Equipment list table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS equipment_list (
                id INT PRIMARY KEY AUTO_INCREMENT,
                equipment_id INT NOT NULL,
                user_id INT NOT NULL,
                asset_reference_number VARCHAR(100),
                equipment_classification VARCHAR(100),
                site_location VARCHAR(255),
                vertical_ref_floor VARCHAR(50),
                zone_context VARCHAR(100),
                additional_notes TEXT,
                image VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_equipment_list_equipment (equipment_id),
                INDEX idx_equipment_list_user (user_id)
            )
        `);

        // Tasks table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS tasks (
                id INT PRIMARY KEY AUTO_INCREMENT,
                equipment_id INT NOT NULL,
                assigned_to INT,
                priority ENUM('LOW', 'MEDIUM', 'HIGH') DEFAULT 'MEDIUM',
                status ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED') DEFAULT 'PENDING',
                description TEXT,
                due_date DATE,
                completed_at TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE,
                FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
            )
        `);

        // Task checklist table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS task_checklist (
                id INT PRIMARY KEY AUTO_INCREMENT,
                task_id INT NOT NULL,
                updated_by INT NULL,
                point TEXT NOT NULL,
                status ENUM('OK', 'ATTENTION', 'PENDING') NOT NULL DEFAULT 'PENDING',
                initials VARCHAR(10),
                measured_value VARCHAR(100),
                bms_reading VARCHAR(100),
                remarks TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
                FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
                INDEX idx_task_checklist_task (task_id),
                INDEX idx_task_checklist_user (updated_by)
            )
        `);

        // Activity logs table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS activity_logs (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT,
                action_type VARCHAR(50) NOT NULL,
                entity_type VARCHAR(50) NOT NULL,
                entity_id INT,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            )
        `);

        console.log('Tables created successfully');

        // Check if admin user exists
        const [rows] = await connection.query(
            'SELECT * FROM users WHERE email = ?',
            ['admin@system.com']
        );

        if (rows.length === 0) {
            // Create admin user
            const hashedPassword = await bcrypt.hash('Admin@123', 10);
            await connection.query(
                'INSERT INTO users (name, email, password, role, is_active) VALUES (?, ?, ?, ?, ?)',
                ['Super Admin', 'admin@system.com', hashedPassword, 'SUPER_ADMIN', true]
            );
            console.log('✅ Admin user created:');
            console.log('   Email: admin@system.com');
            console.log('   Password: Admin@123');
        } else {
            console.log('✅ Admin user already exists');
        }

        // Create a sample building
        const [buildings] = await connection.query('SELECT * FROM buildings LIMIT 1');
        if (buildings.length === 0) {
            await connection.query(
                'INSERT INTO buildings (name, location, description) VALUES (?, ?, ?)',
                ['Main Building', '123 Main Street', 'Headquarters building']
            );
            console.log('✅ Sample building created');
        }

        console.log('\n🎉 Database initialization complete!');
        for (const [equipmentType, items] of Object.entries(EQUIPMENT_CHECKLISTS)) {
            for (let i = 0; i < items.length; i += 1) {
                await connection.query(
                    `
                        INSERT INTO equipment_checklist_templates
                        (equipment_type, item_text, item_type, sort_order)
                        VALUES (?, ?, ?, ?)
                        ON DUPLICATE KEY UPDATE sort_order = VALUES(sort_order)
                    `,
                    [
                        equipmentType.trim().toLowerCase(),
                        items[i],
                        CHECKLIST_ITEM_TYPES.CHECKLIST,
                        i + 1
                    ]
                );
            }
        }

        console.log('\nYou can now login with:');
        console.log('Email: admin@system.com');
        console.log('Password: Admin@123');

    } catch (error) {
        console.error('❌ Error initializing database:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
        process.exit();
    }
};

initDatabase();

