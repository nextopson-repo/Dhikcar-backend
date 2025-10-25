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
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Address } from './Address';
import { RepublishCarDetails } from './RepublishCars';
import { UserAuth } from './UserAuth';

@Entity('CarDetails')
export class CarDetails extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid', { nullable: true })
  userId!: string | null;

  @ManyToOne(() => UserAuth, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: UserAuth;

  @ManyToOne(() => Address, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'addressId' })
  address!: Address;

  @Column({ type: 'simple-array', nullable: true })
  carImages!: string[];

  @OneToMany(() => RepublishCarDetails, (republishedCarDetails) => republishedCarDetails.carDetails)
  republishedCarDetails!: RepublishCarDetails[];

  @Column({ type: 'varchar', nullable: true })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string;

  @Column({ type: 'boolean', default: false })
  isActive!: boolean;

  @Column({ type: 'varchar', nullable: true })
  carName!: string;

  @Column({ type: 'varchar', nullable: true })
  brand!: string;

  @Column({ type: 'varchar', nullable: true })
  model!: string;

  @Column({ type: 'varchar', nullable: true })
  variant!: string;

  @Column({ type: 'enum', enum: ['Petrol', 'Diesel', 'CNG', 'Electric'], nullable: false })
  fuelType!: 'Petrol' | 'Diesel' | 'CNG' | 'Electric';

  @Column({ type: 'enum', enum: ['Manual', 'Automatic'], nullable: false })
  transmission!: 'Manual' | 'Automatic';

  @Column({ type: 'varchar', nullable: true })
  bodyType!: string;

  @Column({ type: 'enum', enum: ['1st', '2nd', '3rd', '3+'], nullable: false })
  ownership!: '1st' | '2nd' | '3rd' | '3+';

  @Column({ type: 'int', default: 0 })
  manufacturingYear!: number;

  @Column({ type: 'int', default: 0 })
  registrationYear!: number;

  @Column({ type: 'enum', enum: ['Sell', 'Buy'], nullable: true })
  isSale!: 'Sell' | 'Buy';

  @Column({ type: 'int', default: 0 })
  carPrice!: number;

  @Column({ type: 'int', default: 0 })
  kmDriven!: number;

  @Column({ type: 'int', default: 0 })
  seats!: number;

  @Column({ type: 'boolean', default: false })
  isSold!: boolean;

  @Column({ type: 'boolean', nullable: true })
  workingWithDealer!: boolean;

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
    this.id = randomBytes(8).toString('hex');
  }

  @BeforeUpdate()
  async updateTimestamp() {}
}
