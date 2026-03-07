const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
            notEmpty: {
                msg: 'Name is required'
            }
        }
    },
    email: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: {
            msg: 'Email already exists'
        },
        validate: {
            isEmail: {
                msg: 'Must be a valid email address'
            }
        }
    },
    password: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
            notEmpty: {
                msg: 'Password is required'
            },
            len: {
                args: [6, 100],
                msg: 'Password must be at least 6 characters long'
            }
        }
    },
    role: {
        type: DataTypes.ENUM('SUPER_ADMIN', 'MANAGER', 'TECHNICIAN'),
        defaultValue: 'TECHNICIAN'
    },
    building_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    version: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
    },
    deleted_at: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'users',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    hooks: {
        beforeCreate: async (user) => {
            if (user.password) {
                const salt = await bcrypt.genSalt(10);
                user.password = await bcrypt.hash(user.password, salt);
                console.log('Password hashed for new user:', user.email);
            }
        },
        beforeUpdate: async (user) => {
            if (user.changed('password')) {
                const salt = await bcrypt.genSalt(10);
                user.password = await bcrypt.hash(user.password, salt);
                console.log('Password updated for user:', user.email);
            }
            if (!user.changed('version')) {
                user.setDataValue('version', (Number(user.getDataValue('version')) || 0) + 1);
            }
        }
    }
});

// Instance method to check password
User.prototype.validatePassword = async function(password) {
    try {
        console.log('Validating password for user:', this.email);
        const isValid = await bcrypt.compare(password, this.password);
        console.log('Password validation result:', isValid);
        return isValid;
    } catch (error) {
        console.error('Error validating password:', error);
        return false;
    }
};

// Class method to find by email with password
User.findByEmail = function(email) {
    return this.findOne({ where: { email } });
};

module.exports = User;
