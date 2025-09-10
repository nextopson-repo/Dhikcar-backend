import { randomBytes } from 'crypto';
import {
  BaseEntity,
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('DropdownOptions')
export class DropdownOptions extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  residential!: string;

  @Column({ type: 'varchar' })
  commercial!: string;

  @Column({ type: 'varchar' })
  propertyType!: string;

  @Column({ type: 'varchar' })
  state!: string;

  @Column({ type: 'varchar' })
  city!: string;

  @Column({ type: 'varchar' })
  locality!: string;

  @Column({ type: 'varchar' })
  furnishing!: string;

  @Column({ type: 'varchar' })
  propertyFacing!: string;

  @Column({ type: 'varchar' })
  viewsOfProperty!: string;

  @Column({ type: 'varchar' })
  amenities!: string;

  @Column({ type: 'varchar' })
  BHKs!: string;

  @Column({ type: 'varchar' })
  constructionStatus!: string;

  @Column({ type: 'varchar' })
  ageOfProperty!: string;

  @Column({ type: 'varchar' })
  reraApproved!: string;

  @Column({ type: 'varchar' })
  fencing!: string;

  @Column({ type: 'varchar' })
  soilType!: string;

  @Column({ type: 'varchar' })
  approachRoad!: string;

  @Column({ type: 'varchar' })
  washrooms!: string;

  @Column({ type: 'varchar' })
  parking!: string;

  @Column({ type: 'varchar' })
  lookingFor!: string;

  @Column({ type: 'varchar' })
  needFor!: string;

  @Column({ type: 'varchar' })
  furnishingType!: string;

  @Column({ type: 'varchar' })
  BHKType!: string;

  @Column({ type: 'varchar' })
  images!: string;

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
}
