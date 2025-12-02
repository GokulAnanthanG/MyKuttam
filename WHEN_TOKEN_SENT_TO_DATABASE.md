# When FCM Token is Sent to Database

## ⏰ Exact Moments When Token is Sent

### 1. **App Starts + User is Logged In** (Automatic)

**When:** App initializes and user is authenticated

**Code Location:** `src/hooks/usePushNotification.ts` - `useEffect` initialization

```typescript
useEffect(() => {
  const initialize = async () => {
    // Check permission
    const hasPermission = await messaging().hasPermission();
    
    if (hasPermission) {
      // Get FCM token
      await getToken(); // ← Sends to database here
    }
  };
  
  initialize();
}, []);
```

**Flow:**
1. App starts
2. User is logged in
3. Hook checks if permission is granted
4. If yes → Gets token → Sends to database

### 2. **User Logs In** (Automatic)

**When:** User successfully logs in

**Code Location:** `src/components/PushNotificationHandler.tsx`

```typescript
useEffect(() => {
  // Request permission if not granted and user is authenticated
  if (currentUser && !isPermissionGranted) {
    requestPermission().catch((error) => {
      console.error('Error requesting notification permission:', error);
    });
  }
}, [currentUser, isPermissionGranted, requestPermission]);
```

**Flow:**
1. User logs in
2. `PushNotificationHandler` detects user is authenticated
3. Requests permission (if not granted)
4. Permission granted → Gets token → Sends to database

### 3. **Permission is Granted** (Automatic)

**When:** User grants notification permission

**Code Location:** `src/hooks/usePushNotification.ts` - `requestPermission()`

```typescript
const requestPermission = async (): Promise<boolean> => {
  const granted = await messaging().requestPermission();
  
  if (granted) {
    await getToken(); // ← Sends to database here
  }
  
  return granted;
};
```

**Flow:**
1. User grants permission
2. `getToken()` is called
3. Token is sent to database

### 4. **Token is Refreshed** (Automatic)

**When:** Firebase refreshes the FCM token

**Code Location:** `src/hooks/usePushNotification.ts` - `onTokenRefresh` listener

```typescript
useEffect(() => {
  const unsubscribe = messaging().onTokenRefresh(async (token: string) => {
    console.log('FCM token refreshed:', token);
    setFcmToken(token);
    
    // Send new token to backend
    const authToken = await getStoredToken();
    if (token && authToken) {
      await saveFCMToken(token, authToken); // ← Sends to database here
    }
  });
  
  return unsubscribe;
}, []);
```

**Flow:**
1. Firebase refreshes token (automatic)
2. `onTokenRefresh` callback fires
3. New token is sent to database automatically

## 📋 Complete Timeline

```
┌─────────────────────────────────────────┐
│  USER INSTALLS APP                      │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│  USER OPENS APP                          │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│  USER LOGS IN                            │
│  → PushNotificationHandler detects user │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│  APP REQUESTS PERMISSION                 │
│  → requestPermission()                  │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│  USER GRANTS PERMISSION                 │
│  ✅ Permission granted                  │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│  GET FCM TOKEN                           │
│  → messaging().getToken()               │
│  → Token: "dKx8abc123..."               │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│  SEND TOKEN TO DATABASE                  │
│  → saveFCMToken(token, authToken)      │
│  → POST /api/user/fcm-token             │
│  → Backend stores in database           │
│  ✅ TOKEN IN DATABASE NOW!              │
└─────────────────────────────────────────┘
```

## 🔄 Token Refresh Timeline

```
┌─────────────────────────────────────────┐
│  FIREBASE REFRESHES TOKEN               │
│  (Automatic - happens anytime)          │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│  onTokenRefresh CALLBACK FIRES           │
│  → New token received                   │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│  SEND NEW TOKEN TO DATABASE              │
│  → saveFCMToken(newToken, authToken)   │
│  → POST /api/user/fcm-token             │
│  → Backend updates database             │
│  ✅ DATABASE UPDATED WITH NEW TOKEN!    │
└─────────────────────────────────────────┘
```

## 📊 When Token is NOT Sent

### ❌ Token is NOT sent when:
1. **User denies permission** - No token generated
2. **User is not logged in** - No auth token to send with request
3. **App is closed** - Token already in database (no need to resend)
4. **Token fetch fails** - Error handling prevents sending

## 🎯 Summary Table

| Event | Token Sent? | When |
|-------|-------------|------|
| App starts + User logged in | ✅ Yes | Immediately if permission granted |
| User logs in | ✅ Yes | After permission granted |
| Permission granted | ✅ Yes | Immediately after grant |
| Token refreshed | ✅ Yes | Automatically when refreshed |
| App closed | ❌ No | Already in database |
| User denies permission | ❌ No | No token to send |
| User not logged in | ❌ No | No auth token |

## 💻 Code Flow

### Initial Send (App Start/Login)
```typescript
// 1. App starts
useEffect(() => {
  initialize(); // ← Runs on mount
}, []);

// 2. Initialize
const initialize = async () => {
  if (hasPermission) {
    await getToken(); // ← Gets and sends token
  }
};

// 3. Get Token
const getToken = async () => {
  const token = await messaging().getToken();
  setFcmToken(token);
  
  // Send to database
  await saveFCMToken(token, authToken); // ← SENT HERE
};
```

### Token Refresh Send
```typescript
// Listener is always active
messaging().onTokenRefresh(async (token) => {
  // Send new token to database
  await saveFCMToken(token, authToken); // ← SENT HERE
});
```

## ✅ Answer

**Token is sent to database:**
1. ✅ **When app starts** (if user logged in + permission granted)
2. ✅ **When user logs in** (after permission granted)
3. ✅ **When permission is granted** (immediately)
4. ✅ **When token is refreshed** (automatically)

**Token is NOT sent:**
- ❌ When app is closed (already in database)
- ❌ When permission is denied (no token)
- ❌ When user is not logged in (no auth token)

## 🔍 How to Verify

Check your backend database:
```javascript
// Check if token is in database
const user = await User.findById(userId);
console.log('FCM Token:', user.fcm_token);
console.log('Updated at:', user.fcm_token_updated_at);
```

Check app logs:
- Look for: `"FCM token sent to backend successfully"`
- Look for: `"Refreshed FCM token sent to backend"`







