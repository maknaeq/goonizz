import { Request, Response } from 'express';
import { User } from '../entities/User.js';

export async function getUsers(req: Request, res: Response) {
    const users = await User.find();
    res.status(200).json(users.map(({ password, ...user }) => user));
}

export async function createUser(req: Request, res: Response) {
    const { email, password, role } = req.body;

    if (!email || !password) {
        res.status(400).json({ errors: ['email and password are required'] });
        return;
    }

    const user = User.create({ email, password, role });
    await user.save();

    const { password: _password, ...userWithoutPassword } = user;
    res.status(201).json(userWithoutPassword);
}
