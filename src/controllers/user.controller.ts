import { Request, Response } from 'express';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { User } from '../entities/User.js';
import { CreateUserDto } from '../dtos/CreateUserDto.js';

export async function getUsers(req: Request, res: Response) {
    const users = await User.find();
    res.status(200).json(users.map(({ password, ...user }) => user));
}

export async function createUser(req: Request, res: Response) {
    const dto = plainToInstance(CreateUserDto, req.body);
    const validationErrors = await validate(dto);

    if (validationErrors.length > 0) {
        const errors = validationErrors.flatMap((error) =>
            Object.values(error.constraints ?? {})
        );
        res.status(400).json({ errors });
        return;
    }

    const user = User.create({ email: dto.email, password: dto.password, role: dto.role });
    await user.save();

    const { password: _password, ...userWithoutPassword } = user;
    res.status(201).json(userWithoutPassword);
}
