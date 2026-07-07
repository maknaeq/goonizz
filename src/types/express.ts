import { User } from '../entities/User.js';

declare global {
    namespace Express {
        interface Request {
            user?: User;
        }
    }
}

export {};
