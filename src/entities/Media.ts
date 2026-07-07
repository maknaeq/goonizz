import {
    BaseEntity,
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn
} from 'typeorm';

@Entity()
export class Media extends BaseEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    path!: string;

    @Column()
    mimetype!: string;

    @Column()
    width!: number;

    @Column()
    height!: number;

    @Column()
    size!: number;

    @CreateDateColumn()
    createdAt!: Date;
}
