import { findUserById, normalizeUserDocument, saveUser, } from '../repositories/userRepository.js';
import { verifyToken } from '../utils/authToken.js';
export async function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
        ? authHeader.slice('Bearer '.length)
        : '';
    if (!token) {
        return res.status(403).json({ success: false, message: 'No token provided' });
    }
    try {
        const payload = verifyToken(token);
        if (!payload.id) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }
        const user = await findUserById(payload.id);
        if (!user || user.accessToken !== token) {
            return res.status(401).json({
                success: false,
                message: 'Session expired or logged in from another device',
            });
        }
        normalizeUserDocument(user);
        await saveUser(user);
        req.user = user;
        req.userId = String(user._id);
        return next();
    }
    catch {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
}
