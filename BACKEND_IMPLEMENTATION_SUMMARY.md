# Backend Implementation Summary

Quick reference for what needs to be done in the backend.

## 🎯 Essential Tasks (Must Do)

### 1. Firebase Admin Setup
- [ ] Install `firebase-admin` package
- [ ] Download service account JSON from Firebase Console
- [ ] Initialize Firebase Admin SDK
- [ ] Create `config/firebase-admin.js`

### 2. Database Updates
- [ ] Add `fcm_token` field to User model (String, nullable)
- [ ] Add `fcm_token_updated_at` field to User model (Date, nullable)
- [ ] Run migration if using migrations

### 3. API Endpoints (Required)
- [ ] `POST /api/user/fcm-token` - Save FCM token
- [ ] `DELETE /api/user/fcm-token` - Delete FCM token

### 4. Notification Service (Required)
- [ ] Create `services/notification-service.js`
- [ ] Implement `sendToUser()` method
- [ ] Implement `sendToMultipleUsers()` method
- [ ] Handle invalid token errors

## 🔧 Integration Tasks (Recommended)

### 5. News Integration
- [ ] Send notification when news is created
- [ ] Include news ID in notification data

### 6. Donation Integration
- [ ] Send notification to manager when donation received
- [ ] Include donation details in notification data

### 7. Gallery Integration
- [ ] Send notification when photo is uploaded
- [ ] Include image ID in notification data

## 📝 Code Files to Create/Update

### Files to Create:
1. `config/firebase-admin.js` - Firebase Admin initialization
2. `services/notification-service.js` - Notification sending logic

### Files to Update:
1. `models/User.js` - Add FCM token fields
2. `routes/user.js` - Add FCM token endpoints
3. `routes/news.js` - Add notification on news creation
4. `routes/donations.js` - Add notification on donation
5. `routes/gallery.js` - Add notification on photo upload

## ⚡ Quick Implementation

**Minimum Required (for basic functionality):**
1. Firebase Admin setup
2. User model update
3. FCM token endpoints (POST & DELETE)
4. Notification service with `sendToUser()`

**Full Implementation (recommended):**
- All of the above +
- `sendToMultipleUsers()` method
- Integration with news/donation/gallery
- Error handling for invalid tokens

## 🚨 Critical Points

1. **Service Account JSON**: Must be downloaded from Firebase Console
2. **Token Format**: All data values must be strings (FCM requirement)
3. **Error Handling**: Don't fail main operations if notifications fail
4. **Token Updates**: Update existing token, don't create duplicates
5. **Invalid Tokens**: Remove from database when detected

## 📚 Documentation Files

- `BACKEND_QUICK_START.md` - Step-by-step implementation
- `BACKEND_PUSH_NOTIFICATIONS.md` - Complete reference guide
- `BACKEND_IMPLEMENTATION_CHECKLIST.md` - Detailed checklist

## ⏱️ Estimated Time

- **Minimum Setup**: 30-45 minutes
- **Full Implementation**: 1-2 hours
- **Testing**: 30 minutes







