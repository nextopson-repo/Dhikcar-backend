import { BaseEntity, Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { UserAuth } from './UserAuth';

@Entity('transaction_table')
export class Transaction extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  userId!: string;

  @ManyToOne(() => UserAuth, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: UserAuth;

  @Column({ type: 'varchar', length: 100 })
  transactionId!: string;

  @Column({ type: 'varchar', length: 30 })
  transactionStatus!: string;

  @Column('timestamp')
  transactionDate!: Date;

  @Column('varchar')
  packageName!: string;

  @Column('int')
  packagePrice!: number;

  @Column('int')
  activeDays!: number;

  @Column({ type: 'int', default: 1 })
  packageQuantity!: number;

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
}
