import { randomBytes } from 'crypto';
import {
  BaseEntity,
  BeforeInsert,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Address } from './Address';
import { RequirementEnquiry } from './RequirementEnquiry';
import { UserAuth } from './UserAuth';

@Entity('CarRequirement')
export class CarRequirement extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => Address, (address) => address.addressFor)
  @JoinColumn({ name: 'addressId' })
  addressId!: Address;

  @Column('uuid')
  userId!: string;

  @ManyToOne(() => UserAuth, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: UserAuth;

  @Column('uuid', { nullable: true })
  postId!: string;

  @Column({ type: 'varchar', nullable: true })
  minBudget!: string;

  @Column({ type: 'varchar', nullable: true })
  maxBugdget!: string;

  @Column({ type: 'varchar' })
  category!: string;

  @Column({ type: 'varchar' })
  subCategory!: string;

  // @Column({ type: 'int', nullable: true })
  // bhks!: number;

  // @Column({ type: 'varchar', nullable: true })
  // furnishing!: string;

  @Column({ type: 'enum', enum: ['sale', 'buy'], nullable: true })
  needFor!: 'sale' | 'buy';

  // @Column({ type: 'varchar', nullable: true })
  // bhkRequired!: string;

  // @Column({ type: 'float', nullable: true })
  // landArea!: number;

  // @Column({ type: 'float', nullable: true })
  // plotArea!: number;

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

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP(6)',
    precision: 6,
  })
  createdAt!: Date;

  @Column({
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
}
