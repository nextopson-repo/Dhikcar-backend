import { randomBytes } from 'crypto';
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

@Entity('CarEnquiry')
export class CarEnquiry extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  userId!: string;

  @Column({ type: 'uuid', nullable: true })
  carId!: string;

  @Column({ type: 'uuid', nullable: true })
  ownerId!: string;

  @Column({ type: 'boolean', default: false })
  calling!: boolean;

  @ManyToOne(() => CarDetails)
  @JoinColumn({ name: 'carId' })
  carDetails!: CarDetails;

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

  @BeforeInsert()
  async generateUUID() {
    this.id = randomBytes(16).toString('hex');
  }

  @BeforeUpdate()
  async updateTimestamp() {
    // Optional: Custom update logic
  }
}
