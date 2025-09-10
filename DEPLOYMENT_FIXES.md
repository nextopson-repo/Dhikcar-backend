# EC2 Deployment Fixes

## Issues Identified and Fixed

### 1. **Duplicate Entry Error (ER_DUP_ENTRY)**

#### **Problem**
```
Duplicate entry 'vs1733707@gmail.com' for key 'UserAuth.IDX_bd3c63240f3a847b92cde81ca5'
```

#### **Root Cause**
- The signup handler was trying to update a user with an email that already exists for another user
- No proper duplicate handling logic was in place
- Database constraints were being violated

#### **Solution Implemented**

1. **Enhanced Signup Handler** (`src/api/controllers/auth/signupHandler.ts`)
   - Added proper duplicate detection logic
   - Implemented cleanup of duplicate users before updates
   - Added retry logic for save operations
   - Maintained existing response structure

2. **Key Improvements**:
   ```typescript
   // Before: Simple update that could cause duplicates
   existingUser.email = email;
   
   // After: Smart duplicate handling
   if (existingUserByMobile && existingUserByEmail && existingUserByMobile.id !== existingUserByEmail.id) {
     // Handle duplicate scenarios with proper cleanup
     const verifiedUser = existingUserByMobile.isFullyVerified() ? existingUserByMobile : 
                         existingUserByEmail.isFullyVerified() ? existingUserByEmail : null;
     
     if (verifiedUser) {
       // Delete unverified duplicate and use verified user
       const unverifiedUser = existingUserByMobile.isFullyVerified() ? existingUserByEmail : existingUserByMobile;
       await userLoginRepository.delete(unverifiedUser.id);
       userToSave = verifiedUser;
     }
   }
   ```

3. **Save with Retry Logic**:
   ```typescript
   try {
     savedUser = await userLoginRepository.save(userToSave);
   } catch (saveError: any) {
     if (saveError && saveError.code === 'ER_DUP_ENTRY') {
       // Find existing user and update instead
       const existingUser = await userLoginRepository.findOne({
         where: [{ email: email }, { mobileNumber: mobileNumber }]
       });
       
       if (existingUser) {
         // Update existing user instead of creating new one
         existingUser.fullName = fullName;
         existingUser.mobileNumber = mobileNumber;
         existingUser.email = email;
         // ... other updates
         savedUser = await userLoginRepository.save(existingUser);
       }
     }
   }
   ```

### 2. **MySQL Configuration Warnings**

#### **Problem**
```
Ignoring invalid configuration option passed to Connection: acquireTimeout
Ignoring invalid configuration option passed to Connection: timeout
```

#### **Root Cause**
- Using deprecated MySQL2 configuration options
- These options are not supported in newer versions of MySQL2

#### **Solution Implemented**

**Fixed Database Configuration** (`src/server.ts`):
```typescript
// Before: Deprecated options
extra: {
  connectionLimit: 10, 
  connectTimeout: 60000, 
  acquireTimeout: 60000,  // ❌ Deprecated
  timeout: 60000,         // ❌ Deprecated
  idleTimeout: 60000,
},

// After: Clean configuration
extra: {
  connectionLimit: 10, 
  // Removed deprecated options: acquireTimeout, timeout
  // These options are not supported in newer versions of MySQL2
},
```

### 3. **Database Cleanup Utility**

#### **Created Cleanup Script** (`src/utils/cleanupDuplicates.ts`)
- Automatically detects duplicate users by email and mobile
- Prioritizes fully verified users
- Keeps newest users when verification status is equal
- Safely deletes duplicate entries

#### **Usage**
```bash
# Run cleanup script
npm run cleanup-duplicates
```

## Deployment Steps

### 1. **Update Code**
```bash
# Pull latest changes
git pull origin main

# Install dependencies
npm install
```

### 2. **Run Database Cleanup** (One-time)
```bash
# Clean up existing duplicates
npm run cleanup-duplicates
```

### 3. **Restart Application**
```bash
# Restart PM2 process
pm2 restart nextdealAppServer

# Check logs
pm2 logs nextdealAppServer
```

### 4. **Verify Fixes**
```bash
# Check for errors
pm2 logs nextdealAppServer --lines 50

# Test signup endpoint
curl -X POST http://your-ec2-ip:5000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Test User",
    "mobileNumber": "1234567890",
    "email": "test@example.com",
    "userType": "EndUser"
  }'
```

## Expected Results

### **Before Fix**
- ❌ Duplicate entry errors in logs
- ❌ MySQL configuration warnings
- ❌ Failed signup attempts
- ❌ Database constraint violations

### **After Fix**
- ✅ No duplicate entry errors
- ✅ No MySQL configuration warnings
- ✅ Successful signup with proper duplicate handling
- ✅ Clean database operations

## Monitoring

### **Check Logs**
```bash
# Monitor real-time logs
pm2 logs nextdealAppServer --lines 100

# Check for specific errors
pm2 logs nextdealAppServer | grep -i "duplicate\|error"
```

### **Database Health**
```bash
# Check for remaining duplicates
mysql -h your-db-host -u your-username -p your-database -e "
SELECT email, COUNT(*) as count 
FROM UserAuth 
GROUP BY email 
HAVING count > 1;
"
```

## Rollback Plan

If issues persist:

1. **Revert to previous version**:
   ```bash
   git checkout HEAD~1
   npm install
   pm2 restart nextdealAppServer
   ```

2. **Manual database cleanup**:
   ```sql
   -- Find duplicates
   SELECT email, COUNT(*) as count 
   FROM UserAuth 
   GROUP BY email 
   HAVING count > 1;
   
   -- Delete specific duplicates (be careful!)
   DELETE FROM UserAuth WHERE id = 'duplicate-user-id';
   ```

## Prevention

### **Future Considerations**
1. **Unique Constraints**: Ensure database has proper unique constraints
2. **Validation**: Add client-side validation for email/mobile uniqueness
3. **Monitoring**: Set up alerts for duplicate entry errors
4. **Testing**: Add integration tests for duplicate scenarios

### **Best Practices**
1. **Always use transactions** for user operations
2. **Implement proper error handling** for database constraints
3. **Use retry logic** for transient failures
4. **Monitor database performance** and connection health

## Summary

The fixes address:
- ✅ **Duplicate entry errors** with smart handling logic
- ✅ **MySQL configuration warnings** by removing deprecated options
- ✅ **Database integrity** with proper cleanup utilities
- ✅ **User experience** by maintaining existing response structure
- ✅ **System stability** with proper error handling and retry logic

The application should now handle duplicate user scenarios gracefully without throwing database errors or configuration warnings. 