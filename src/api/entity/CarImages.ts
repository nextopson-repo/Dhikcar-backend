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

@Entity('CarImages')
export class CarImages extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', nullable: false })
  imageKey!: string;

  @Column({ type: 'varchar', nullable: true })
  presignedUrl!: string;

  @Column({ type: 'enum', enum: ['left', 'right', 'front', 'back', 'door', 'roof', 'window', 'other'], nullable: true })
  imgClassifications!: string;

  @Column({ type: 'int', default: null })
  accurencyPercent!: number;

  @Column({ type: 'uuid', nullable: true })
  carId!: string;

  @ManyToOne(() => CarDetails, (car) => car.carImages)
  @JoinColumn({ name: 'carId' })
  car!: CarDetails;

  @Column({ type: 'varchar', nullable: true, default: null })
  createdBy!: string;

  @Column({ type: 'varchar', nullable: true, default: null })
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
