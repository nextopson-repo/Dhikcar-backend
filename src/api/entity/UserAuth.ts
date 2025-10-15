import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import {
  BaseEntity,
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { BlockUser } from './BlockUser';
// import { CarDetails } from './CarDetails';
import { CarRequirement } from './CarRequirement';
import { Connections } from './Connection';
import { RepublishCarDetails } from './RepublishCars';
import { UserReport } from './UserReport';
import { UserReview } from './UserReview';

@Entity('UserAuth')
export class UserAuth extends BaseEntity {
  // profilePictureUploadId(receiverId: any, arg1: string, profilePictureUploadId: any, arg3: string) {
  //   throw new Error('Method not implemented.');
  // }
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 15, unique: true, nullable: true })
  mobileNumber!: string;

  @Column({ type: 'enum', enum: ['Dealer', 'Owner', 'EndUser'], default: 'EndUser' })
  userType!: 'Dealer' | 'Owner' | 'EndUser';

  @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
  email!: string;

  @Column({ type: 'boolean', default: false })
  isAdmin!: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  fullName!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userProfileUrl!: string;

  @Column({ type: 'varchar', length: 4, nullable: true })
  emailOTP!: string | null;

  @Column({ type: 'varchar', length: 4, nullable: true })
  mobileOTP!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  emailOTPSentAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  mobileOTPSentAt!: Date | null;

  @Column({ type: 'boolean', default: false })
  isEmailVerified!: boolean;

  @Column({ type: 'varchar', nullable: true })
  address!: string | null;

  @Column({ type: 'varchar', nullable: true })
  landmark!: string | null;

  @Column({ type: 'varchar', nullable: true })
  city!: string | null;

  @Column({ type: 'varchar', nullable: true })
  state!: string | null;

  @Column({ type: 'varchar', nullable: true })
  pin!: string | null;

  @Column({ type: 'boolean', default: false })
  isMobileVerified!: boolean;

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

  @Column({ type: 'boolean', default: false })
  isLocked!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lockedUntil!: Date | null;

  @Column({ type: 'int', default: 0 })
  failedLoginAttempts!: number;

  @Column({ type: 'int', default: 0 })
  failedOTPAttempts!: number;

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAttempt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  lastOTPAttempt!: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  googleId!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  appleId!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  profileImg!: string;

  @Column({ type: 'boolean', default: false })
  isSignedUp!: boolean;

  // New field for temporary account system
  @Column({ type: 'enum', enum: ['real', 'temporary'], default: 'real' })
  accountType!: 'real' | 'temporary';

  // New field to track if temporary account should be deleted when real user signs up
  @Column({ type: 'boolean', default: false })
  shouldDeleteOnRealSignup!: boolean;

  // New field to link temporary account to real user (when real user signs up)
  @Column({ type: 'uuid', nullable: true })
  linkedToRealUser!: string | null;

  firstName: any;
  lastName: any;

  // Add relations for reviews
  @OneToMany('UserReview', 'user')
  receivedReviews!: UserReview[];

  @OneToMany('UserReview', 'reviewer')
  givenReviews!: UserReview[];

  // Connection relations
  @OneToMany(() => Connections, (connection) => connection.requester)
  sentConnections!: Connections[];

  @OneToMany(() => Connections, (connection) => connection.receiver)
  receivedConnections!: Connections[];

  // Block relations
  @OneToMany(() => BlockUser, (block) => block.blocker)
  blockedUsers!: BlockUser[];

  @OneToMany(() => BlockUser, (block) => block.blockedUser)
  blockedByUsers!: BlockUser[];

  // Report relations
  @OneToMany(() => UserReport, (report) => report.reporter)
  reportedUsers!: UserReport[];

  @OneToMany(() => UserReport, (report) => report.reportedUser)
  reportedByUsers!: UserReport[];

  // Property relations
  // Keep relation for user-to-cars to enable cascade operations from user
  // Note: The owning side is on CarDetails with userId FK
  // import left commented at top originally; we avoid circular deps by string callback
  @OneToMany('CarDetails', 'user')
  carDetails!: any[];

  // PropertyRequirement relations
  @OneToMany(() => CarRequirement, (requirement: any) => requirement.user)
  carRequirements!: CarRequirement[];

  // RepublishProperty relations
  @OneToMany(() => RepublishCarDetails, (republishedCar) => republishedCar.owner)
  ownedRepublishedCars!: RepublishCarDetails[];

  @OneToMany(() => RepublishCarDetails, (republishedCar) => republishedCar.republisher)
  republishedProperties!: RepublishCarDetails[];

  @Column({
    type: 'enum',
    enum: ['Google', 'Apple', 'Facebook', 'Twitter', 'Instagram', 'LinkedIn', 'Youtube', 'Other'],
    nullable: true,
  })
  socialMedia!: 'Google' | 'Apple' | 'Facebook' | 'Twitter' | 'Instagram' | 'LinkedIn' | 'Youtube' | 'Other';

  @Column({ type: 'varchar', length: 255, nullable: true })
  socialMediaLink!: string;

  @Column({ type: 'json', nullable: true })
  socialMediaLinks!: Array<{ type: string; link: string }> | null;

  @BeforeInsert()
  async generateUUID() {
    this.id = randomUUID();
  }

  @BeforeUpdate()
  async updateTimestamp() {
    // Any update logic if needed
  }

  private generateOTP(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  generateEmailOTP(): void {
    this.emailOTP = this.generateOTP();
    this.emailOTPSentAt = new Date();
    this.isEmailVerified = false;
  }

  generateMobileOTP(): void {
    this.mobileOTP = this.generateOTP();
    this.mobileOTPSentAt = new Date();
    this.isMobileVerified = false;
  }

  verifyEmailOTP(otp: string): boolean {
    if (this.emailOTP === otp) {
      this.isEmailVerified = true;
      this.emailOTP = null;
      return true;
    }
    return false;
  }

  verifyMobileOTP(otp: string): boolean {
    if (this.mobileOTP === otp) {
      this.isMobileVerified = true;
      this.mobileOTP = null;
      return true;
    }
    return false;
  }

  isFullyVerified(): boolean {
    return this.isEmailVerified && this.isMobileVerified;
  }

  // New method to check if account is temporary
  isTemporaryAccount(): boolean {
    return this.accountType === 'temporary';
  }

  // New method to check if account can login
  canLogin(): boolean {
    return this.accountType === 'real' && !this.isLocked;
  }

  static async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, 10);
  }

  static async validatePassword(password: string, hashedPassword: string): Promise<boolean> {
    return await bcrypt.compare(password, hashedPassword);
  }

  lockAccount(minutes: number = 15): void {
    this.isLocked = true;
    this.lockedUntil = new Date(Date.now() + minutes * 60 * 1000);
  }

  unlockAccount(): void {
    this.isLocked = false;
    this.lockedUntil = null;
    this.failedLoginAttempts = 0;
    this.failedOTPAttempts = 0;
  }

  incrementFailedLoginAttempts(): void {
    this.failedLoginAttempts += 1;
    this.lastLoginAttempt = new Date();

    if (this.failedLoginAttempts >= 5) {
      this.lockAccount(15);
    }
  }

  incrementFailedOTPAttempts(): void {
    this.failedOTPAttempts += 1;
    this.lastOTPAttempt = new Date();

    if (this.failedOTPAttempts >= 3) {
      this.lockAccount(30);
    }
  }

  resetFailedAttempts(): void {
    this.failedLoginAttempts = 0;
    this.failedOTPAttempts = 0;
    this.lastLoginAttempt = null;
    this.lastOTPAttempt = null;
  }
}
