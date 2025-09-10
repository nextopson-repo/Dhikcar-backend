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

import { CarDetails } from './CarDetails';
import { UserAuth } from './UserAuth';

export enum CarReportReason {
  SPAM = 'spam',
  INAPPROPRIATE_CONTENT = 'inappropriate_content',
  FAKE_CAR = 'fake_property',
  WRONG_PRICE = 'wrong_price',
  WRONG_LOCATION = 'wrong_location',
  DUPLICATE_CAR = 'duplicate_car',
  EXPIRED_CAR = 'expired_car',
  OTHER = 'other',
}

export enum CarReportStatus {
  PENDING = 'pending',
  REVIEWED = 'reviewed',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed',
}

@Entity('CarReport')
export class CarReport extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  reporterId!: string;

  @Column({ type: 'uuid' })
  carId!: string;

  @Column({ type: 'enum', enum: CarReportReason })
  reason!: CarReportReason;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'enum', enum: CarReportStatus, default: CarReportStatus.PENDING })
  status!: CarReportStatus;

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

  @ManyToOne(() => CarDetails, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'carDetailsId' })
  carDetails!: CarDetails;

  @BeforeInsert()
  async generateUUID() {
    this.id = randomUUID();
  }

  @BeforeUpdate()
  async updateTimestamp() {
    // Optional: Custom update logic
  }
}
