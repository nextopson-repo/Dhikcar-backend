import { randomBytes } from 'crypto';
import {
  BaseEntity,
  BeforeInsert,
  BeforeUpdate,
  Check,
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

@Entity('RepublishCarDetails')
@Check('ownerId != republisherId')
export class RepublishCarDetails extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  carId!: string;

  @Column('uuid')
  ownerId!: string;

  @Column('uuid')
  republisherId!: string;

  @Column({
    type: 'enum',
    enum: ['Accepted', 'Rejected', 'Pending'],
    default: 'Pending',
  })
  status!: 'Accepted' | 'Rejected' | 'Pending';

  @Column({ type: 'int', default: 0 })
  markAsSoldRequests!: number;

  @ManyToOne(() => CarDetails, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'carId' })
  carDetails!: CarDetails;

  @ManyToOne(() => UserAuth, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId' })
  owner!: UserAuth;

  @ManyToOne(() => UserAuth, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'republisherId' })
  republisher!: UserAuth;

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

  @BeforeInsert()
  @BeforeUpdate()
  async validateSelfRepublish() {
    if (this.ownerId === this.republisherId) {
      throw new Error('Owner cannot republish their own car. ownerId and republisherId must be different.');
    }
  }
}
