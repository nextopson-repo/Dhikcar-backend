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
import { RequirementEnquiry } from './RequirementEnquiry';
import { UserAuth } from './UserAuth';

@Entity('CarRequirement')
export class CarRequirement extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  userId!: string;

  @ManyToOne(() => UserAuth, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: UserAuth;

  @ManyToOne(() => Address, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'addressId' })
  address!: Address;

  @Column({ type: 'varchar', nullable: true })
  carName!: string;

  @Column({ type: 'varchar', nullable: true })
  brand!: string;

  @Column({ type: 'varchar', nullable: true })
  model!: string;

  @Column({ type: 'varchar', nullable: true })
  variant!: string;

  @Column({ type: 'enum', enum: ['Petrol', 'Diesel', 'CNG', 'Electric'], nullable: true })
  fuelType!: 'Petrol' | 'Diesel' | 'CNG' | 'Electric';

  @Column({ type: 'enum', enum: ['Manual', 'Automatic'], nullable: true })
  transmission!: 'Manual' | 'Automatic';

  @Column({ type: 'varchar', nullable: true })
  bodyType!: string;

  @Column({ type: 'enum', enum: ['1st', '2nd', '3rd', '3+'], nullable: true })
  ownership!: '1st' | '2nd' | '3rd' | '3+';

  @Column({ type: 'int', nullable: true })
  manufacturingYear!: number;

  @Column({ type: 'int', nullable: true })
  registrationYear!: number;

  @Column({ type: 'enum', enum: ['Sell', 'Buy'], nullable: true })
  isSale!: 'Sell' | 'Buy';

  @Column({ type: 'int', nullable: true })
  minPrice!: number;

  @Column({ type: 'int', nullable: true })
  maxPrice!: number;

  @Column({ type: 'int', nullable: true })
  maxKmDriven!: number;

  @Column({ type: 'int', nullable: true })
  seats!: number;

  @Column({ type: 'text', nullable: true })
  description!: string;

  @Column({ type: 'simple-array', nullable: true })
  enquiryIds!: string[];

  @Column({ type: 'boolean', default: false })
  isFound!: boolean;

  @OneToMany(() => RequirementEnquiry, (enquiry) => enquiry.requirement)
  enquiries!: RequirementEnquiry[];

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
