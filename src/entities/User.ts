import {
  BaseEntity,
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  RelationId,
} from "typeorm";
import { Media } from "./Media.js";

export enum UserRole {
  USER = "user",
  CONTRIBUTOR = "contributor",
  ADMIN = "admin",
}

@Entity()
export class User extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  email!: string;

  @Column()
  password!: string;

  @Column({ type: "simple-enum", enum: UserRole, default: UserRole.USER })
  role: UserRole = UserRole.USER;

  @ManyToOne(() => Media, { nullable: true, onDelete: "SET NULL" })
  avatar?: Media;

  @RelationId((user: User) => user.avatar)
  avatarId?: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
