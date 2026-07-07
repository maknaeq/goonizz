import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../entities/User.js';
import { JWT_SECRET } from '../config.js';
import '../types/express.js';

export async function checkUser(req: Request, res: Response, next: NextFunction) {
    const token = req.cookies?.token;

    if (!token) {
        res.status(401).json({ errors: ['Not authenticated'] });
        return;
    }

    try {
        const payload = jwt.verify(token, JWT_SECRET) as { userId: number };
        const user = await User.findOneBy({ id: payload.userId });

        if (!user) {
            res.status(401).json({ errors: ['Not authenticated'] });
            return;
        }

        req.user = user;
        next();
    } catch {
        res.status(401).json({ errors: ['Not authenticated'] });
    }
}
