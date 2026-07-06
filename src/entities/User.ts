import {
    BaseEntity,
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn
} from 'typeorm';
import {IsDate, IsEmail, IsEnum, MinLength} from "class-validator";

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

    @CreateDateColumn()
    @IsDate()
    createdAt!: Date;

    @UpdateDateColumn()
    @IsDate()
    updatedAt!: Date;
}