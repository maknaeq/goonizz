import {
    BaseEntity,
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    RelationId
} from 'typeorm';
import {IsDate, IsEmail, IsEnum, MinLength} from "class-validator";
import { Media } from './Media.js';

export enum UserRole {
    USER = "user",
    CONTRIBUTOR = "contributor",
    ADMIN = "admin",
}

@Entity()
export class User extends  BaseEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    @IsEmail()
    email!: string;

    @Column()
    @MinLength(8)
    password!: string;

    @Column({ type: "simple-enum", enum: UserRole, default: UserRole.USER })
    @IsEnum(UserRole)
    role: UserRole = UserRole.USER;

    @ManyToOne(() => Media, { nullable: true, onDelete: 'SET NULL' })
    avatar?: Media;

    @RelationId((user: User) => user.avatar)
    avatarId?: number;

    @CreateDateColumn()
    @IsDate()
    createdAt!: Date;

    @UpdateDateColumn()
    @IsDate()
    updatedAt!: Date;
}