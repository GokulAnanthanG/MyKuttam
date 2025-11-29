# How Push Notifications Work When App is Closed

## 🔑 Key Understanding

**The backend does NOT use the React state token!**

The backend uses the token stored in the **database**, not the React state.

## 📊 Complete Flow Explained

### When App is Open (User Logs In)

```
1. App generates FCM token
   ↓
2. Token stored in React state (temporary, for app's use)
   ↓
3. Token sent to backend via API
   ↓
4. Backend stores token in DATABASE (permanent)
   ↓
5. Database now has: User.fcm_token = "dKx8abc123..."
```

### When App is Closed (Backend Sends Notification)

```
1. Backend gets token from DATABASE (not React state!)
   const user = await User.findById(userId);
   const token = user.fcm_token; // ← From database
   
2. Backend sends notification using database token
   admin.messaging().send({
     token: user.fcm_token, // ← Database token
     notification: { ... }
   })
   
3. Firebase Cloud Messaging (system service) receives it
   ↓
4. Android/iOS system shows notification
   ↓
5. User sees notification in system tray
   ↓
6. User taps notification
   ↓
7. App launches and handles notification
```

## 🎯 Important Points

### React State Token (Frontend)
- **Purpose**: For app to know its own token
- **Location**: App memory (temporary)
- **Used by**: App itself
- **When app closes**: State is lost (doesn't matter!)

### Database Token (Backend)
- **Purpose**: For backend to send notifications
- **Location**: Database (permanent)
- **Used by**: Backend server
- **When app closes**: Still exists in database!

## 🔄 Why This Works

### 1. Token is Stored in Database (Permanent)
```javascript
// Backend Database
User {
  _id: "user123",
  phone: "1234567890",
  fcm_token: "dKx8abc123...", // ← Stored here permanently
  fcm_token_updated_at: "2025-01-15T10:30:00Z"
}
```

### 2. Backend Uses Database Token (Not React State)
```javascript
// Backend code (runs on server, not in app)
const user = await User.findById(userId);
// Gets token from DATABASE, not from React state!

await admin.messaging().send({
  token: user.fcm_token, // ← From database
  notification: {
    title: "New News",
    body: "Check it out",
  },
});
```

### 3. Firebase System Service Handles Delivery
- Firebase Cloud Messaging is a **system-level service**
- It runs independently of your app
- It can receive notifications even when app is closed
- Android/iOS system shows the notification

## 📱 What Happens When App is Closed

### Scenario: Backend Sends Notification

```
┌─────────────────────────────────────────┐
│         BACKEND SERVER                  │
│  (Runs independently, app doesn't      │
│   need to be open)                      │
│                                          │
│  1. Get token from DATABASE             │
│     const user = await User.find()      │
│     token = user.fcm_token              │
│                                          │
│  2. Send to Firebase                    │
│     admin.messaging().send({            │
│       token: token                      │
│     })                                  │
└──────────────────┬──────────────────────┘
                   │
                   │ Firebase Cloud Messaging
                   ▼
┌─────────────────────────────────────────┐
│      FIREBASE CLOUD MESSAGING            │
│      (System Service - Always Running)   │
│                                          │
│  Receives notification                   │
│  Routes to correct device                │
└──────────────────┬──────────────────────┘
                   │
                   │ System-level delivery
                   ▼
┌─────────────────────────────────────────┐
│      ANDROID/IOS SYSTEM                  │
│      (Device Operating System)            │
│                                          │
│  Shows notification in system tray       │
│  (Even if app is closed!)                │
└──────────────────┬──────────────────────┘
                   │
                   │ User taps notification
                   ▼
┌─────────────────────────────────────────┐
│         APP LAUNCHES                     │
│                                          │
│  App opens                              │
│  Handles notification                    │
│  Navigates to relevant screen            │
└─────────────────────────────────────────┘
```

## 💡 Key Misconception Clarified

**❌ Wrong Understanding:**
"Backend uses React state token → App must be open"

**✅ Correct Understanding:**
"Backend uses database token → App can be closed"

## 🔍 Code Evidence

### Frontend (App) - Token in State
```typescript
// src/hooks/usePushNotification.ts
const [fcmToken, setFcmToken] = useState<string | null>(null);
// This is just for the app to know its token
// Backend doesn't use this!
```

### Frontend (App) - Send to Backend
```typescript
// src/services/notifications.ts
await saveFCMToken(token, authToken);
// Sends token to backend
// Backend stores it in DATABASE
```

### Backend - Get from Database
```javascript
// Backend code
const user = await User.findById(userId);
// Gets token from DATABASE, not from React state!

await admin.messaging().send({
  token: user.fcm_token, // ← Database token
  // ...
});
```

## 🎯 Summary

1. **React State Token**: Temporary, for app's own use
2. **Database Token**: Permanent, for backend to send notifications
3. **Backend Uses Database**: Not React state
4. **System Service**: Firebase handles delivery even when app is closed
5. **App Can Be Closed**: Backend uses database token, not app state

## ✅ Answer to Your Question

**Q: If token is stored in state, how does it send push notification when app is closed?**

**A:** The backend doesn't use the React state token! It uses the token stored in the **database**. The React state token is just for the app to know its own token. When the app sends the token to the backend, it's stored permanently in the database. The backend then uses that database token to send notifications, which works even when the app is closed because:
1. Backend runs on server (independent of app)
2. Token is in database (permanent storage)
3. Firebase system service handles delivery
4. Android/iOS system shows notification



