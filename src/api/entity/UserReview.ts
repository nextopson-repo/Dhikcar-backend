import { randomBytes } from 'crypto';
import {
  BaseEntity,
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
// import type { UserAuth } from './UserAuth';

@Entity('UserReview')
export class UserReview extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 36 })
  userId!: string;

  @Column({ type: 'varchar', length: 36 })
  reviewerId!: string;

  @Column({ type: 'text', nullable: true })
  message!: string;

  @Column({ type: 'int', default: 5 })
  rating!: number;

  @Column({ type: 'boolean', default: false })
  isVerified!: boolean;

  @Column({ type: 'boolean', default: false })
  isReported!: boolean;

  @Column({ type: 'text', nullable: true })
  reportReason!: string;

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

  // @ManyToOne('UserAuth', 'receivedReviews', { onDelete: 'CASCADE' })
  // @JoinColumn({ name: 'userId' })
  // user!: UserAuth;

  // @ManyToOne('UserAuth', 'givenReviews', { onDelete: 'CASCADE' })
  // @JoinColumn({ name: 'reviewerId' })
  // reviewer!: UserAuth;

  @BeforeInsert()
  async generateUUID() {
    this.id = randomBytes(16).toString('hex');
  }

  // Helper methods
  updateRating(newRating: number): void {
    if (newRating >= 0 && newRating <= 10) {
      this.rating = newRating;
    } else {
      throw new Error('Rating must be between 0 and 10');
    }
  }

  markAsVerified(): void {
    this.isVerified = true;
  }

  reportReview(reason: string): void {
    this.isReported = true;
    this.reportReason = reason;
  }

  removeReport(): void {
    this.isReported = false;
    this.reportReason = '';
  }
}
