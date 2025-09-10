import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('IndianCity')
export class IndianCity extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 100 })
  state!: string;

  @Column({ type: 'decimal', precision: 9, scale: 6 })
  lat!: number;

  @Column({ type: 'decimal', precision: 9, scale: 6 })
  lng!: number;
}
