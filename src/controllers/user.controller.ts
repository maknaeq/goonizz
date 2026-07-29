import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../entities/User.js';
import { CreateUserDto } from '../dtos/CreateUserDto.js';
import { CreateTokenDto } from '../dtos/CreateTokenDto.js';
import { hashPassword } from '../utils/hash.js';
import { JWT_SECRET } from '../config.js';
import { createMedia, deleteMedia } from '../utils/media.js';
import { validateDto } from '../utils/validation.js';
import { omit } from '../utils/serialize.js';
import '../types/express.js';

export async function getUsers(req: Request, res: Response) {
    const users = await User.find({ relations: { avatar: true } });
    res.status(200).json(users.map((user) => omit(user, 'password')));
}

export async function createUser(req: Request, res: Response) {
    const { dto, errors } = await validateDto(CreateUserDto, req.body);

    if (errors.length > 0) {
        res.status(400).json({ errors });
        return;
    }

    const user = User.create({ email: dto.email, password: hashPassword(dto.password) });
    await user.save();

    res.status(201).json(omit(user, 'password'));
}

export async function createToken(req: Request, res: Response) {
    const { dto, errors } = await validateDto(CreateTokenDto, req.body);

    if (errors.length > 0) {
        res.status(400).json({ errors });
        return;
    }

    const user = await User.findOne({ where: { email: dto.email } });

    if (!user || user.password !== hashPassword(dto.password)) {
        res.status(401).json({ errors: ['Invalid email or password'] });
        return;
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1d' });

    res.cookie('token', token, {
        httpOnly: true,
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000,
    });

    res.status(201).json(omit(user, 'password'));
}

export async function deleteToken(req: Request, res: Response) {
    res.clearCookie('token');
    res.status(204).send();
}

export async function uploadAvatar(req: Request, res: Response) {
    if (!req.file) {
        res.status(400).json({ errors: ['No file uploaded'] });
        return;
    }

    const user = req.user!;
    const previousAvatar = (await User.findOne({ where: { id: user.id }, relations: { avatar: true } }))?.avatar;

    user.avatar = await createMedia(req.file.buffer, 'avatars', req.file.originalname, req.file.mimetype, {
        width: 256,
        height: 256,
    });
    await user.save();

    if (previousAvatar) {
        await deleteMedia(previousAvatar);
    }

    res.status(200).json(omit(user, 'password'));
}

export function getPublic(req: Request, res: Response) {
    res.status(200).json({ message: 'This is a public route, anyone can access it.' });
}

export function getPrivate(req: Request, res: Response) {
    res.status(200).json({ message: 'This is a private route.', user: omit(req.user!, 'password') });
}
