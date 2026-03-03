const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized'
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `User role ${req.user.role} is not authorized to access this route`
            });
        }

        next();
    };
};

const checkBuildingAccess = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Not authorized'
        });
    }

    if (req.user.role === 'SUPER_ADMIN') {
        return next();
    }

    const buildingId = req.params.id || req.body.building_id;
    
    if (!buildingId) {
        if (req.user.role === 'MANAGER' || req.user.role === 'TECHNICIAN') {
            req.body.building_id = req.user.building_id;
        }
        return next();
    }

    if (req.user.role === 'MANAGER' && req.user.building_id !== parseInt(buildingId)) {
        return res.status(403).json({
            success: false,
            message: 'You can only access your own building'
        });
    }

    if (req.user.role === 'TECHNICIAN' && req.user.building_id !== parseInt(buildingId)) {
        return res.status(403).json({
            success: false,
            message: 'You can only access your own building'
        });
    }

    next();
};

module.exports = { authorize, checkBuildingAccess };