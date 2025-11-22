# API Structure Documentation

## Update Profile API

### Endpoint
```
PUT /api/user/update-profile
```

### Headers

**When sending image (FormData):**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data (automatically set by React Native)
```

**When NOT sending image (JSON):**
```
Content-Type: application/json
Authorization: Bearer <token>
```

### Request Body

**Option 1: With Image File (FormData)**
```
FormData:
  - name: "John Doe" (string)
  - dob: "1990-05-15" (string)
  - father_name: "Father Name" (string)
  - address: "123 Main Street, City, State 12345" (string)
  - avatar: <File> (image file)
```

**Option 2: Without Image File (JSON)**
```json
{
  "name": "John Doe",
  "dob": "1990-05-15",
  "father_name": "Father Name",
  "address": "123 Main Street, City, State 12345",
  "avatar": "https://example.com/avatar.jpg"
}
```

**Note:** 
- All fields are optional. Only send the fields you want to update.
- When a new image is selected, the request is sent as FormData with the image file.
- When no new image is selected, the request is sent as JSON.
- The `avatar` field in JSON is used when updating an existing avatar URL.

### Response (Success - 200)
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "user": {
      "id": "691b42cae31b57c527f9fe21",
      "name": "John Doe",
      "phone": "7904484468",
      "dob": "1990-05-15T00:00:00.000Z",
      "avatar": "https://example.com/avatar.jpg",
      "father_name": "Father Name",
      "address": "123 Main Street, City, State 12345",
      "account_type": "MANAGEMENT",
      "role": "ADMIN",
      "status": "ACTIVE",
      "report_count": 0
    }
  }
}
```

### Response (Error - 400/401/500)
```json
{
  "success": false,
  "message": "Error message here"
}
```

### Implementation Flow
1. User edits profile fields in ProfileScreen
2. User clicks "Save Changes"
3. `handleUpdate()` validates and formats data
4. Calls `updateProfile()` from AuthContext
5. AuthContext calls `AuthService.updateProfile()` with token and updates
6. API returns updated user data
7. User data is saved to Realm for offline access
8. UI updates with new user data
9. Success toast is shown

---

## Reset Password API

### Endpoint
```
POST /api/user/reset-password
```

### Headers
```
Content-Type: application/json
Authorization: Bearer <token>
```

### Request Body
```json
{
  "currentPassword": "oldPassword123",
  "newPassword": "newPassword456"
}
```

### Response (Success - 200)
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

### Response (Error - 400/401/500)
```json
{
  "success": false,
  "message": "Error message here"
}
```

### Common Error Messages
- `400`: "Current password is incorrect"
- `400`: "New password must be at least 6 characters"
- `401`: "Unauthorized" or "Invalid token"
- `500`: "Internal server error"

### Implementation Flow
1. User clicks menu (three dots) → "Reset Password"
2. Reset Password modal opens
3. User enters:
   - Current Password
   - New Password (min 6 characters)
   - Confirm New Password
4. User clicks "Reset Password"
5. `handleResetPasswordSubmit()` validates:
   - All fields are filled
   - New password is at least 6 characters
   - New password matches confirm password
6. Calls `resetPassword()` from AuthContext
7. AuthContext calls `AuthService.resetPassword()` with token and passwords
8. API validates current password and updates to new password
9. Success toast is shown
10. Modal closes and form is reset

---

## Code Structure

### 1. API Configuration (`src/config/api.ts`)
```typescript
export const endpoints = {
  updateProfile: `${BASE_URL}/api/user/update-profile`,
  resetPassword: `${BASE_URL}/api/user/reset-password`,
};
```

### 2. Auth Service (`src/services/auth.ts`)
```typescript
// Update Profile
updateProfile: async (token: string, updates: {...}) => {
  // Makes PUT request to updateProfile endpoint
  // Returns { success, message, user }
}

// Reset Password
resetPassword: async (token: string, payload: {...}) => {
  // Makes POST request to resetPassword endpoint
  // Returns { success, message }
}
```

### 3. Auth Context (`src/context/AuthContext.tsx`)
```typescript
// Update Profile
updateProfile: async (updates) => {
  // Gets token from Realm
  // Calls AuthService.updateProfile()
  // Saves updated user to Realm
  // Updates currentUser state
  // Shows success/error toast
}

// Reset Password
resetPassword: async (currentPassword, newPassword) => {
  // Gets token from Realm
  // Calls AuthService.resetPassword()
  // Shows success/error toast
}
```

### 4. Profile Screen (`src/screens/ProfileScreen.tsx`)
```typescript
// Update Profile
handleUpdate: async () => {
  // Validates form data
  // Formats date to YYYY-MM-DD
  // Calls updateProfile() from context
  // Closes edit mode on success
}

// Reset Password
handleResetPasswordSubmit: async () => {
  // Validates all password fields
  // Checks password match
  // Calls resetPassword() from context
  // Closes modal and resets form on success
}
```

---

## Data Flow Diagram

### Update Profile
```
ProfileScreen (UI)
    ↓ handleUpdate()
    ↓ Validates & formats data
AuthContext.updateProfile()
    ↓ Gets token from Realm
    ↓ Calls AuthService
AuthService.updateProfile()
    ↓ PUT /api/user/update-profile
    ↓ With Bearer token
API Server
    ↓ Validates token
    ↓ Updates user in database
    ↓ Returns updated user
AuthService
    ↓ Maps response to StoredUser
AuthContext
    ↓ Saves to Realm
    ↓ Updates state
    ↓ Shows toast
ProfileScreen
    ↓ UI updates automatically
```

### Reset Password
```
ProfileScreen (UI)
    ↓ handleResetPasswordSubmit()
    ↓ Validates passwords
AuthContext.resetPassword()
    ↓ Gets token from Realm
    ↓ Calls AuthService
AuthService.resetPassword()
    ↓ POST /api/user/reset-password
    ↓ With Bearer token
API Server
    ↓ Validates token
    ↓ Verifies current password
    ↓ Updates password in database
    ↓ Returns success
AuthService
    ↓ Returns response
AuthContext
    ↓ Shows toast
ProfileScreen
    ↓ Closes modal
    ↓ Resets form
```

---

## Security Considerations

1. **Token Management**
   - Token is stored securely in Realm
   - Token is sent in Authorization header
   - Token is validated on server side

2. **Password Security**
   - Current password is verified before allowing reset
   - New password must meet minimum requirements (6+ characters)
   - Passwords are never stored in plain text (server-side hashing)

3. **Input Validation**
   - Client-side validation for immediate feedback
   - Server-side validation for security
   - Sanitize all inputs before sending to API

4. **Error Handling**
   - Generic error messages for security
   - Specific validation errors for user feedback
   - Network error handling with offline support

---

## Testing Checklist

### Update Profile
- [ ] Update name only
- [ ] Update date of birth
- [ ] Update father's name
- [ ] Update address
- [ ] Update avatar
- [ ] Update multiple fields at once
- [ ] Handle network errors
- [ ] Handle invalid token
- [ ] Verify data persists in Realm
- [ ] Verify UI updates after save

### Reset Password
- [ ] Reset with correct current password
- [ ] Handle incorrect current password
- [ ] Handle password too short (< 6 chars)
- [ ] Handle password mismatch
- [ ] Handle network errors
- [ ] Handle invalid token
- [ ] Verify form resets after success
- [ ] Verify modal closes after success

