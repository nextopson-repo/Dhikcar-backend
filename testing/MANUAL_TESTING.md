# Manual Testing Guide

This guide provides comprehensive manual testing procedures for the NextDeal Property API. Follow these steps to thoroughly test all functionality.

## Prerequisites

1. **Server Running**: Ensure your server is running on `localhost:5000`
2. **API Documentation**: Have the API documentation open for reference
3. **Testing Tools**: Use tools like Postman, curl, or browser developer tools
4. **Test Data**: Use the provided `payload.json` for consistent testing

## Test Environment Setup

### 1. Server Health Check
```bash
# Check if server is running
curl http://localhost:5000/

# Expected Response: 200 OK with server information
```

### 2. API Base URL
```
Base URL: http://localhost:5000/api/v1/property
```

## Manual Test Cases

### 1. Property Creation Tests

#### Test Case 1.1: Valid Property Creation
**Objective**: Verify that a property can be created with valid data

**Steps**:
1. Open Postman or use curl
2. Set method to `POST`
3. Set URL to `http://localhost:5000/api/v1/property/create-update`
4. Set headers:
   ```
   Content-Type: application/json
   Accept: application/json
   ```
5. Set body to raw JSON with the payload from `payload.json`
6. Send request

**Expected Results**:
- Status Code: `201 Created`
- Response contains:
  ```json
  {
    "success": true,
    "message": "Property created successfully",
    "property": {
      "id": "generated-id",
      "propertyName": "Shree krishana",
      "category": "Residential",
      "subCategory": "Flats",
      // ... other fields
    }
  }
  ```

**Pass Criteria**: ✅ Status 201, valid response structure, property data returned

#### Test Case 1.2: Property Creation with Missing Required Fields
**Objective**: Verify validation works for missing required fields

**Steps**:
1. Use the same setup as 1.1
2. Remove required fields like `category`, `subCategory`, `propertyName`
3. Send request

**Expected Results**:
- Status Code: `400 Bad Request`
- Response contains validation error message

**Pass Criteria**: ✅ Status 400, meaningful error message

#### Test Case 1.3: Property Creation with Invalid Data Types
**Objective**: Verify validation works for invalid data types

**Steps**:
1. Use valid payload but change data types:
   - Set `propertyPrice` to string: `"invalid_price"`
   - Set `totalBathrooms` to string: `"invalid_bathrooms"`
2. Send request

**Expected Results**:
- Status Code: `400 Bad Request`
- Response contains type validation error

**Pass Criteria**: ✅ Status 400, type validation error message

### 2. Property Update Tests

#### Test Case 2.1: Valid Property Update
**Objective**: Verify that an existing property can be updated

**Steps**:
1. First create a property (use Test Case 1.1)
2. Note the property ID from the response
3. Create new request with same payload but add:
   ```json
   {
     "propertyId": "id-from-step-2",
     "propertyName": "Updated Property Name",
     "propertyPrice": 50000
   }
   ```
4. Send request

**Expected Results**:
- Status Code: `200 OK`
- Response contains updated property data

**Pass Criteria**: ✅ Status 200, updated data in response

#### Test Case 2.2: Update Non-existent Property
**Objective**: Verify error handling for non-existent property

**Steps**:
1. Use invalid property ID: `"non-existent-id"`
2. Send update request

**Expected Results**:
- Status Code: `404 Not Found`
- Response contains error message

**Pass Criteria**: ✅ Status 404, error message

### 3. Property Retrieval Tests

#### Test Case 3.1: Get Property by ID
**Objective**: Verify property can be retrieved by ID

**Steps**:
1. Create a property first (use Test Case 1.1)
2. Note the property ID
3. Send GET request to: `http://localhost:5000/api/v1/property/{propertyId}`

**Expected Results**:
- Status Code: `200 OK`
- Response contains property data

**Pass Criteria**: ✅ Status 200, property data returned

#### Test Case 3.2: Get Non-existent Property
**Objective**: Verify error handling for non-existent property

**Steps**:
1. Use invalid property ID: `"non-existent-id"`
2. Send GET request

**Expected Results**:
- Status Code: `404 Not Found`
- Response contains error message

**Pass Criteria**: ✅ Status 404, error message

#### Test Case 3.3: Get All Properties
**Objective**: Verify property listing functionality

**Steps**:
1. Send GET request to: `http://localhost:5000/api/v1/property`

**Expected Results**:
- Status Code: `200 OK`
- Response contains array of properties

**Pass Criteria**: ✅ Status 200, properties array returned

### 4. Property Search and Filter Tests

#### Test Case 4.1: Search Properties
**Objective**: Verify property search functionality

**Steps**:
1. Send GET request to: `http://localhost:5000/api/v1/property/search?category=Residential&subCategory=Flats&city=Delhi`

**Expected Results**:
- Status Code: `200 OK`
- Response contains filtered properties

**Pass Criteria**: ✅ Status 200, filtered results returned

#### Test Case 4.2: Filter Properties by Price
**Objective**: Verify price filtering functionality

**Steps**:
1. Send GET request to: `http://localhost:5000/api/v1/property/filter?minPrice=10000&maxPrice=100000&category=Residential`

**Expected Results**:
- Status Code: `200 OK`
- Response contains properties within price range

**Pass Criteria**: ✅ Status 200, filtered results returned

### 5. Property Deletion Tests

#### Test Case 5.1: Delete Property
**Objective**: Verify property deletion functionality

**Steps**:
1. Create a property first (use Test Case 1.1)
2. Note the property ID
3. Send DELETE request to: `http://localhost:5000/api/v1/property/{propertyId}`

**Expected Results**:
- Status Code: `200 OK`
- Response contains success message

**Pass Criteria**: ✅ Status 200, success message

#### Test Case 5.2: Delete Non-existent Property
**Objective**: Verify error handling for non-existent property deletion

**Steps**:
1. Use invalid property ID: `"non-existent-id"`
2. Send DELETE request

**Expected Results**:
- Status Code: `404 Not Found`
- Response contains error message

**Pass Criteria**: ✅ Status 404, error message

### 6. Rate Limiting Tests

#### Test Case 6.1: Rate Limit Verification
**Objective**: Verify rate limiting is working

**Steps**:
1. Send multiple requests quickly (10-15 requests in 1 minute)
2. Monitor responses

**Expected Results**:
- First few requests: `201 Created` or `200 OK`
- Later requests: `429 Too Many Requests`

**Pass Criteria**: ✅ Rate limiting enforced, 429 responses

### 7. Error Handling Tests

#### Test Case 7.1: Malformed JSON
**Objective**: Verify handling of malformed JSON

**Steps**:
1. Send POST request with malformed JSON body
2. Example: `{"invalid": json, "format":}`

**Expected Results**:
- Status Code: `400 Bad Request`
- Response contains parsing error

**Pass Criteria**: ✅ Status 400, parsing error message

#### Test Case 7.2: Wrong HTTP Method
**Objective**: Verify handling of wrong HTTP methods

**Steps**:
1. Send GET request to POST-only endpoint
2. Send PUT request to POST-only endpoint

**Expected Results**:
- Status Code: `404 Not Found` or `405 Method Not Allowed`
- Response contains error message

**Pass Criteria**: ✅ Status 404/405, error message

#### Test Case 7.3: Non-existent Endpoint
**Objective**: Verify handling of non-existent endpoints

**Steps**:
1. Send request to: `http://localhost:5000/api/v1/property/nonexistent`

**Expected Results**:
- Status Code: `404 Not Found`
- Response contains error message

**Pass Criteria**: ✅ Status 404, error message

### 8. Performance Tests

#### Test Case 8.1: Response Time
**Objective**: Verify acceptable response times

**Steps**:
1. Use browser developer tools or Postman
2. Send property creation request
3. Monitor response time

**Expected Results**:
- Response time < 10 seconds
- Consistent response times

**Pass Criteria**: ✅ Response time < 10s, consistent performance

#### Test Case 8.2: Concurrent Requests
**Objective**: Verify handling of concurrent requests

**Steps**:
1. Send 5-10 concurrent requests
2. Monitor all responses

**Expected Results**:
- All requests processed
- Some may be rate limited (429)
- No server crashes

**Pass Criteria**: ✅ All requests handled, no crashes

### 9. Data Validation Tests

#### Test Case 9.1: Required Field Validation
**Objective**: Verify all required fields are validated

**Steps**:
1. Test each required field individually:
   - Remove `userId`
   - Remove `category`
   - Remove `subCategory`
   - Remove `propertyName`
2. Send request for each test

**Expected Results**:
- Status Code: `400 Bad Request` for each missing field
- Specific error message for each field

**Pass Criteria**: ✅ Status 400 for each missing field, specific error messages

#### Test Case 9.2: Data Type Validation
**Objective**: Verify data type validation

**Steps**:
1. Test different data types:
   - String where number expected
   - Number where string expected
   - Invalid enum values
2. Send request for each test

**Expected Results**:
- Status Code: `400 Bad Request` for invalid types
- Specific type error messages

**Pass Criteria**: ✅ Status 400 for invalid types, specific error messages

### 10. Security Tests

#### Test Case 10.1: SQL Injection Prevention
**Objective**: Verify SQL injection prevention

**Steps**:
1. Use payload with SQL injection attempts:
   ```json
   {
     "propertyName": "'; DROP TABLE properties; --"
   }
   ```
2. Send request

**Expected Results**:
- Request processed safely
- No database errors
- Proper validation error if invalid

**Pass Criteria**: ✅ No SQL injection vulnerabilities

#### Test Case 10.2: XSS Prevention
**Objective**: Verify XSS prevention

**Steps**:
1. Use payload with XSS attempts:
   ```json
   {
     "propertyName": "<script>alert('xss')</script>"
   }
   ```
2. Send request

**Expected Results**:
- Request processed safely
- Script tags properly escaped or rejected

**Pass Criteria**: ✅ No XSS vulnerabilities

## Test Documentation

### Test Results Template

For each test case, document:

```markdown
## Test Case: [Name]
**Date**: [Date]
**Tester**: [Name]
**Status**: ✅ PASS / ❌ FAIL

**Steps Taken**:
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Results**:
- [Expected result 1]
- [Expected result 2]

**Actual Results**:
- [Actual result 1]
- [Actual result 2]

**Notes**:
[Any additional notes or observations]

**Screenshots**:
[Attach relevant screenshots if applicable]
```

### Bug Report Template

```markdown
## Bug Report
**Bug ID**: [Auto-generated]
**Date**: [Date]
**Reporter**: [Name]
**Severity**: [Critical/High/Medium/Low]

**Description**:
[Clear description of the bug]

**Steps to Reproduce**:
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Behavior**:
[What should happen]

**Actual Behavior**:
[What actually happened]

**Environment**:
- Server: [Version]
- Client: [Browser/Postman version]
- OS: [Operating system]

**Screenshots**:
[Attach screenshots if applicable]

**Additional Notes**:
[Any additional information]
```

## Test Execution Checklist

### Pre-Testing
- [ ] Server is running on localhost:5000
- [ ] API documentation is available
- [ ] Testing tools are ready (Postman/curl)
- [ ] Test data is prepared
- [ ] Test environment is clean

### During Testing
- [ ] Execute each test case systematically
- [ ] Document results immediately
- [ ] Take screenshots of failures
- [ ] Note any unexpected behavior
- [ ] Test both positive and negative scenarios

### Post-Testing
- [ ] Compile all test results
- [ ] Create bug reports for failures
- [ ] Update test documentation
- [ ] Share results with team
- [ ] Plan retesting for fixed issues

## Tools and Resources

### Recommended Testing Tools
1. **Postman**: API testing and documentation
2. **curl**: Command-line API testing
3. **Browser Developer Tools**: Network monitoring
4. **Jmeter**: Load testing (if needed)

### Useful Commands
```bash
# Health check
curl http://localhost:5000/

# Property creation
curl -X POST http://localhost:5000/api/v1/property/create-update \
  -H "Content-Type: application/json" \
  -d @testing/payload.json

# Property retrieval
curl http://localhost:5000/api/v1/property/{propertyId}

# Property listing
curl http://localhost:5000/api/v1/property
```

## Best Practices

1. **Systematic Approach**: Test one feature at a time
2. **Documentation**: Record all test results
3. **Reproducibility**: Ensure bugs can be reproduced
4. **Environment Control**: Use consistent test environment
5. **Data Management**: Use consistent test data
6. **Error Handling**: Test both success and failure scenarios
7. **Performance**: Monitor response times
8. **Security**: Test for common vulnerabilities

## Conclusion

This manual testing guide provides comprehensive coverage of the Property API functionality. Follow these test cases systematically to ensure thorough testing and identify any issues before deployment.

Remember to:
- Test both positive and negative scenarios
- Document all findings
- Report bugs promptly
- Retest after fixes
- Keep test documentation updated 