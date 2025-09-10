import { randomBytes } from 'crypto';
import { BaseEntity, BeforeInsert, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('Location')
export class Location extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  state!: string;

  @Column({ type: 'varchar', nullable: true })
  stateImageUrl!: string;

  @Column({ type: 'varchar' })
  city!: string;

  @Column({ type: 'varchar', nullable: true })
  cityImageUrl!: string;

  @Column({ type: 'varchar' })
  locality!: string;

  @Column({ type: 'boolean', default: false })
  isActive!: boolean;

  @Column({ type: 'varchar', default: 'system' })
  createdBy!: string;

  @Column({ type: 'varchar', default: 'system' })
  updatedBy!: string;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP(6)',
    precision: 6,
  })
  createdAt!: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP(6)',
    onUpdate: 'CURRENT_TIMESTAMP(6)',
    precision: 6,
  })
  updatedAt!: Date;

  @BeforeInsert()
  async generateUUID() {
    this.id = randomBytes(16).toString('hex');
  }
}
