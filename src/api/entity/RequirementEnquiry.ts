import { randomBytes } from 'crypto';
import { BeforeInsert, Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { CarRequirement } from './CarRequirement';
import { UserAuth } from './UserAuth';

@Entity('RequirementEnquiry')
export class RequirementEnquiry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  userId!: string;

  @Column('uuid')
  requirementId!: string;

  @Column({ type: 'text', nullable: true })
  message?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => CarRequirement, (requirement) => requirement.enquiries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requirementId' })
  requirement!: CarRequirement;

  @ManyToOne(() => UserAuth, (user) => user.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: UserAuth;

  @Column({ type: 'varchar', default: 'system' })
  createdBy!: string;

  @Column({ type: 'varchar', default: 'system' })
  updatedBy!: string;

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
