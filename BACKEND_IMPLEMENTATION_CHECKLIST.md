# Backend Implementation Checklist for Push Notifications

## ✅ Complete Checklist

### Phase 1: Firebase Setup

- [ ] **1.1** Get Firebase Service Account JSON
  - Go to Firebase Console → Project Settings → Service Accounts
  - Click "Generate New Private Key"
  - Download JSON file
  - Save securely in backend project

- [ ] **1.2** Install Firebase Admin SDK
  ```bash
  npm install firebase-admin
  ```

- [ ] **1.3** Initialize Firebase Admin
  - Create `config/firebase-admin.js`
  - Initialize with service account JSON
  - Export admin instance

### Phase 2: Database Schema Updates

- [ ] **2.1** Add FCM Token Fields to User Model
  ```javascript
  fcm_token: String (nullable)
  fcm_token_updated_at: Date (nullable)
  ```

- [ ] **2.2** Create Migration (if using migrations)
  - Add fcm_token column
  - Add fcm_token_updated_at column

### Phase 3: API Endpoints

- [ ] **3.1** Create FCM Token Endpoint
  - `POST /api/user/fcm-token` - Save/update token
  - `DELETE /api/user/fcm-token` - Delete token on logout
  - Add authentication middleware
  - Validate token format
  - Update user record in database

- [ ] **3.2** Create Notification Service
  - `sendToUser()` - Send to single user
  - `sendToMultipleUsers()` - Send to multiple users
  - `sendToTopic()` - Send to topic (optional)
  - Error handling for invalid tokens
  - Token cleanup on errors

- [ ] **3.3** Create Notification Routes (Optional)
  - `POST /api/notifications/send` - Send to specific user
  - `POST /api/notifications/send-news` - Send news notification
  - `POST /api/notifications/send-donation` - Send donation notification
  - Add admin authorization checks

### Phase 4: Integration Points

- [ ] **4.1** News Creation
  - After creating news, send notification to all users
  - Include news ID in notification data

- [ ] **4.2** Donation Creation
  - After receiving donation, send notification to manager
  - Include donation details in notification data

- [ ] **4.3** Gallery Upload
  - After uploading photo, send notification to all users
  - Include image ID in notification data

- [ ] **4.4** User Logout
  - Delete FCM token from database
  - Clear fcm_token field

### Phase 5: Error Handling

- [ ] **5.1** Handle Invalid Tokens
  - Detect invalid/expired tokens
  - Remove invalid tokens from database
  - Log errors for monitoring

- [ ] **5.2** Handle Token Refresh
  - Update existing token (don't create duplicate)
  - Update fcm_token_updated_at timestamp

### Phase 6: Testing

- [ ] **6.1** Test Token Save
  - Test POST /api/user/fcm-token
  - Verify token is saved in database

- [ ] **6.2** Test Token Delete
  - Test DELETE /api/user/fcm-token
  - Verify token is removed from database

- [ ] **6.3** Test Notification Sending
  - Send test notification from backend
  - Verify notification received in app
  - Verify navigation works correctly

## 📋 Implementation Order

1. **First**: Firebase Admin setup (Phase 1)
2. **Second**: Database schema (Phase 2)
3. **Third**: FCM token endpoints (Phase 3.1)
4. **Fourth**: Notification service (Phase 3.2)
5. **Fifth**: Integration with existing features (Phase 4)
6. **Last**: Testing (Phase 6)

## 🚀 Quick Start Implementation

See `BACKEND_QUICK_START.md` for step-by-step code implementation.







