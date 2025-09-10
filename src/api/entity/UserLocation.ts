import { randomBytes } from 'crypto';
import { BaseEntity, BeforeInsert, Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { UserAuth } from './UserAuth';

@Entity('UserLocation')
export class UserLocation extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  userId!: string;

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  latitude?: number;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  longitude?: number;

  @Column({ type: 'varchar', nullable: true })
  address?: string;

  @Column({ type: 'varchar', nullable: true })
  city?: string;

  @Column({ type: 'varchar', nullable: true })
  state?: string;

  @Column({ type: 'varchar', nullable: true })
  locality?: string;

  @Column({ type: 'varchar', nullable: true })
  country?: string;

  @Column({ type: 'varchar', nullable: true })
  postalCode?: string;

  @Column({ type: 'boolean', default: false })
  isCurrentLocation!: boolean;

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

  @ManyToOne(() => UserAuth, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: UserAuth;

  @BeforeInsert()
  async generateUUID() {
    this.id = randomBytes(16).toString('hex');
  }
}
