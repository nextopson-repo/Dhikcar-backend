import { randomBytes } from 'crypto';
import {
  BaseEntity,
  BeforeInsert,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('RepublishProperty')
export class RepublishProperty extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  //  PropertyId = id of property entity
  @Column({ type: 'uuid', nullable: true })
  propertyId!: string;

  @Column({ type: 'uuid', nullable: true })
  republisherId!: string;

  @Column({ type: 'uuid', nullable: true })
  ownerId!: string;

  @Column({ type: 'enum', enum: ['Accepted', 'Rejected', 'Pending'], default: 'Pending' })
  status!: 'Accepted' | 'Rejected' | 'Pending';

  @Column({ type: 'varchar', default: 'system' })
  createdBy!: string;

  @Column({ type: 'varchar', default: 'system' })
  updatedBy!: string;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)', precision: 6 })
  createdAt!: Date;

  @UpdateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP(6)',
    onUpdate: 'CURRENT_TIMESTAMP(6)',
    precision: 6,
  })
  updatedAt!: Date;
  propertyName: any;
  price: any;

  @BeforeInsert()
  async generateUUID() {
    this.id = randomBytes(16).toString('hex');
  }
}
