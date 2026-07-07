import { Router } from 'express';
import {
    getUsers,
    createUser,
    createToken,
    deleteToken,
    getPublic,
    getPrivate,
} from '../controllers/user.controller.js';
import { checkUser } from '../middlewares/checkUser.js';

export const userRouter = Router();

userRouter.get('/', getUsers);
userRouter.post('/', createUser);
userRouter.post('/tokens', createToken);
userRouter.delete('/tokens', deleteToken);
userRouter.get('/public', getPublic);
userRouter.get('/private', checkUser, getPrivate);
