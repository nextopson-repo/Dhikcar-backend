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

export enum ReportReason {
  SPAM = 'spam',
  INAPPROPRIATE_CONTENT = 'inappropriate_content',
  HARASSMENT = 'harassment',
  FAKE_ACCOUNT = 'fake_account',
  VIOLENCE = 'violence',
  OTHER = 'other',
}

export enum ReportStatus {
  PENDING = 'pending',
  REVIEWED = 'reviewed',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed',
}

@Entity('UserReport')
export class UserReport extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  reporterId!: string;

  @Column({ type: 'uuid' })
  reportedUserId!: string;

  @Column({ type: 'enum', enum: ReportReason })
  reason!: ReportReason;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'enum', enum: ReportStatus, default: ReportStatus.PENDING })
  status!: ReportStatus;

  @Column({ type: 'varchar', length: 500, nullable: true })
  adminNotes!: string | null;

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
  @JoinColumn({ name: 'reporterId' })
  reporter!: UserAuth;

  @ManyToOne(() => UserAuth, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reportedUserId' })
  reportedUser!: UserAuth;

  @BeforeInsert()
  async generateUUID() {
    this.id = randomUUID();
  }

  @BeforeUpdate()
  async updateTimestamp() {
    // Optional: Custom update logic
  }
}
