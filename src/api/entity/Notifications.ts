import { randomBytes } from 'crypto';
import {
  BaseEntity,
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum NotificationType {
  WELCOME = 'welcome',
  VERIFICATION = 'verification',
  PROPERTY = 'property',
  REPUBLISH = 'republish',
  ENQUIRY = 'enquiry',
  REVIEW = 'review',
  BOOST = 'boost',
  BROADCAST = 'broadcast',
  TESTING = 'testing',
  ALERT = 'alert',
  WARNING = 'warning',
  OTHER = 'other',
  KYC = 'kyc',
  FOLLOW = 'follow',
}

@Entity('Notifications')
@Index('idx_duplicate_check', ['userId', 'message', 'type', 'actionId', 'createdAt'])
export class Notifications extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  message!: string;

  @Column({ type: 'enum', enum: NotificationType, nullable: true })
  type!: NotificationType;

  @Column({ type: 'boolean', default: false })
  isRead!: boolean;

  @Column({ type: 'longtext', nullable: true })
  mediakey!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  user?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  button?: string;

  @Column({ type: 'json', nullable: true })
  property?: {
    title?: string;
    price?: string;
    location?: string;
    image?: string;
  };

  @Column({ type: 'varchar', length: 512, nullable: true })
  status?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  actionId?: string;

  @Column({ type: 'varchar', length: 255, nullable: true, default: 'default' })
  sound?: string;

  @Column({ type: 'varchar', length: 255, nullable: true, default: 'default' })
  vibration?: string;

  // Bundled notification fields (for social media style grouping)
  @Column({ type: 'boolean', default: false })
  isBundled!: boolean;

  @Column({ type: 'int', default: 1 })
  bundleCount!: number;

  @Column({ type: 'json', nullable: true })
  bundledItems?: Array<{
    id: string;
    userId: string;
    message: string;
    actionId?: string;
    property?: { title?: string; price?: string; location?: string; image?: string };
    createdAt: Date;
  }>;

  @Column({ type: 'varchar', length: 255, nullable: true })
  bundleKey?: string; // Unique key to group similar notifications

  @Column({ type: 'varchar', default: 'system' })
  createdBy!: string;

  @Column({ type: 'varchar', default: 'system' })
  updatedBy?: string;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' })
  updatedAt!: Date;

  @BeforeInsert()
  private async beforeInsert() {
    this.id = this.generateUUID();
  }

  private generateUUID(): string {
    return randomBytes(16).toString('hex');
  }
}
