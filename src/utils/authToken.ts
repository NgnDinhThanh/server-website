import jwt from 'jsonwebtoken'
import type { JwtPayload } from '../types.js'

function getJwtSecret() {
	const secret = process.env.ACCESS_TOKEN_SECRET
	if (!secret) {
		throw new Error('ACCESS_TOKEN_SECRET is not configured')
	}
	return secret
}

export function signAccessToken(payload: JwtPayload) {
	return jwt.sign(payload, getJwtSecret(), {
		expiresIn: '365d',
	})
}

export function signEmailToken(payload: Record<string, unknown>, hours: number) {
	return jwt.sign(payload, getJwtSecret(), {
		expiresIn: `${hours}h`,
	})
}

export function verifyToken<TPayload extends object>(token: string) {
	return jwt.verify(token, getJwtSecret()) as TPayload
}
