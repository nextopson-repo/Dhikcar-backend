import { randomUUID } from 'crypto';
import {
  BaseEntity,
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { UserAuth } from './UserAuth';

@Entity('Connections')
export class Connections extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  requesterId!: string;

  @Column({ type: 'uuid' })
  receiverId!: string;

  @Column({ type: 'boolean', default: true })
  notificationEnabled!: boolean;

  @Column({ type: 'boolean', default: false })
  isMuted!: boolean;

  @Column({ type: 'varchar', default: 'system' })
  createdBy!: string;

  @Column({ type: 'varchar', default: 'system' })
  updatedBy!: string;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)', precision: 6 })
  createdAt!: Date;

  @UpdateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP(6)',
    onUpdate: 'CURRENT_TIMESTAMP(6)',
    precision: 6,
  })
  updatedAt!: Date;

  // Relations
  @ManyToOne(() => UserAuth, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requesterId' })
  requester!: UserAuth;

  @ManyToOne(() => UserAuth, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'receiverId' })
  receiver!: UserAuth;

  @BeforeInsert()
  async generateUUID() {
    this.id = randomUUID();
  }

  @BeforeUpdate()
  async updateTimestamp() {
    // Optional: Custom update logic
  }
}
