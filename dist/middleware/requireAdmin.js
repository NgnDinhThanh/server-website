export function requireAdmin(req, res, next) {
    const user = req.user;
    if (!user || (user.role !== 0 && user.role !== 1)) {
        return res.status(403).json({ error: 'Admin privileges are required' });
    }
    return next();
}
