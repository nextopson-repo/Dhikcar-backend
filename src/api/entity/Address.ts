import { randomBytes } from 'crypto';
import {
  BaseEntity,
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { CarDetails } from './CarDetails';

@Entity('Address')
export class Address extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', nullable: true })
  state!: string;

  @Column({ type: 'varchar', nullable: true })
  city!: string;

  @Column({ type: 'varchar', nullable: true })
  locality!: string;

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  latitude!: number;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  longitude!: number;

  @OneToOne(() => CarDetails, (car) => car.address)
  @JoinColumn()
  addressFor!: CarDetails;

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
