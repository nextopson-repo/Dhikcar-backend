import { UserAuth } from '@/api/entity/UserAuth';
import { AppDataSource } from '@/server';

/**
 * Utility script to clean up duplicate user entries in the database
 * This should be run once to fix existing duplicate entries
 */
export const cleanupDuplicateUsers = async (): Promise<void> => {
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const userRepository = queryRunner.manager.getRepository(UserAuth);

    // Find all users
    const allUsers = await userRepository.find();
    console.log(`Found ${allUsers.length} total users`);

    const duplicatesByEmail = new Map<string, UserAuth[]>();
    const duplicatesByMobile = new Map<string, UserAuth[]>();

    // Group users by email and mobile
    allUsers.forEach((user) => {
      if (user.email) {
        if (!duplicatesByEmail.has(user.email)) {
          duplicatesByEmail.set(user.email, []);
        }
        duplicatesByEmail.get(user.email)!.push(user);
      }

      if (user.mobileNumber) {
        if (!duplicatesByMobile.has(user.mobileNumber)) {
          duplicatesByMobile.set(user.mobileNumber, []);
        }
        duplicatesByMobile.get(user.mobileNumber)!.push(user);
      }
    });

    let deletedCount = 0;

    // Handle email duplicates
    for (const [email, users] of duplicatesByEmail.entries()) {
      if (users.length > 1) {
        console.log(`Found ${users.length} users with email: ${email}`);

        // Sort by verification status and creation date
        const sortedUsers = users.sort((a, b) => {
          // Fully verified users first
          if (a.isFullyVerified() && !b.isFullyVerified()) return -1;
          if (!a.isFullyVerified() && b.isFullyVerified()) return 1;

          // Then by creation date (newest first)
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

        // Keep the first user (most verified/newest), delete the rest
        const userToKeep = sortedUsers[0];
        const usersToDelete = sortedUsers.slice(1);

        for (const userToDelete of usersToDelete) {
          try {
            await userRepository.delete(userToDelete.id);
            console.log(`Deleted duplicate user with ID: ${userToDelete.id}, email: ${userToDelete.email}`);
            deletedCount++;
          } catch (error) {
            console.error(`Failed to delete user ${userToDelete.id}:`, error);
          }
        }
      }
    }

    // Handle mobile duplicates
    for (const [mobile, users] of duplicatesByMobile.entries()) {
      if (users.length > 1) {
        console.log(`Found ${users.length} users with mobile: ${mobile}`);

        // Sort by verification status and creation date
        const sortedUsers = users.sort((a, b) => {
          // Fully verified users first
          if (a.isFullyVerified() && !b.isFullyVerified()) return -1;
          if (!a.isFullyVerified() && b.isFullyVerified()) return 1;

          // Then by creation date (newest first)
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

        // Keep the first user (most verified/newest), delete the rest
        const userToKeep = sortedUsers[0];
        const usersToDelete = sortedUsers.slice(1);

        for (const userToDelete of usersToDelete) {
          try {
            await userRepository.delete(userToDelete.id);
            console.log(`Deleted duplicate user with ID: ${userToDelete.id}, mobile: ${userToDelete.mobileNumber}`);
            deletedCount++;
          } catch (error) {
            console.error(`Failed to delete user ${userToDelete.id}:`, error);
          }
        }
      }
    }

    await queryRunner.commitTransaction();
    console.log(`Cleanup completed. Deleted ${deletedCount} duplicate users.`);
  } catch (error) {
    await queryRunner.rollbackTransaction();
    console.error('Error during cleanup:', error);
    throw error;
  } finally {
    await queryRunner.release();
  }
};

// Run cleanup if this script is executed directly
if (require.main === module) {
  AppDataSource.initialize()
    .then(async () => {
      console.log('Database connected. Starting cleanup...');
      await cleanupDuplicateUsers();
      console.log('Cleanup completed successfully.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed to initialize database:', error);
      process.exit(1);
    });
}
