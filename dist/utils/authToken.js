import jwt from 'jsonwebtoken';
function getJwtSecret() {
    const secret = process.env.ACCESS_TOKEN_SECRET;
    if (!secret) {
        throw new Error('ACCESS_TOKEN_SECRET is not configured');
    }
    return secret;
}
export function signAccessToken(payload) {
    return jwt.sign(payload, getJwtSecret(), {
        expiresIn: '365d',
    });
}
export function signEmailToken(payload, hours) {
    return jwt.sign(payload, getJwtSecret(), {
        expiresIn: `${hours}h`,
    });
}
export function verifyToken(token) {
    return jwt.verify(token, getJwtSecret());
}
