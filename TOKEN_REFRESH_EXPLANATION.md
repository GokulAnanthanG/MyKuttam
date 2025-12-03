# How Token Refresh Works Automatically

## Overview

Firebase Cloud Messaging (FCM) tokens can be refreshed by Firebase for various reasons. The app automatically handles this refresh and sends the new token to your backend.

## When Firebase Refreshes Tokens

Firebase automatically refreshes FCM tokens in these scenarios:

1. **App Reinstalled** - New installation gets a new token
2. **App Data Cleared** - Clearing app data invalidates old token
3. **Token Expired** - Firebase periodically refreshes tokens
4. **Device Settings Changed** - Some device changes trigger refresh
5. **Firebase Service Update** - Firebase SDK updates may refresh tokens

## How It Works in the Code

### Step 1: Firebase Triggers Token Refresh

Firebase SDK automatically detects when a token needs to be refreshed and generates a new one.

### Step 2: App Listens for Token Refresh

```typescript
// src/hooks/usePushNotification.ts (lines 177-195)

useEffect(() => {
  // This listener is set up when the hook initializes
  const unsubscribe = messaging().onTokenRefresh(async (token: string) => {
    // Firebase calls this callback when token is refreshed
    console.log('FCM token refreshed:', token);
    
    // Update local state with new token
    setFcmToken(token);
    
    // Automatically send new token to backend
    const authToken = await getStoredToken();
    if (token && authToken) {
      try {
        await saveFCMToken(token, authToken);
        console.log('Refreshed FCM token sent to backend');
      } catch (error) {
        console.error('Error sending refreshed FCM token to backend:', error);
      }
    }
  });

  // Cleanup listener when component unmounts
  return unsubscribe;
}, []);
```

### Step 3: Send Token to Backend

```typescript
// src/services/notifications.ts (lines 15-37)

export const saveFCMToken = async (fcmToken: string, authToken: string) => {
  // Makes POST request to backend
  const response = await fetch(endpoints.fcmToken, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ fcm_token: fcmToken }),
  });
  
  // Backend updates user's FCM token in database
  return response.json();
};
```

## Complete Flow Diagram

```
┌─────────────────────────────────────────┐
│  Firebase Detects Token Needs Refresh   │
│  (Automatic - Firebase SDK)             │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│  Firebase Generates New Token           │
│  (Automatic - Firebase SDK)             │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│  onTokenRefresh Callback Triggered      │
│  (Automatic - usePushNotification hook) │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│  Update Local State                     │
│  setFcmToken(newToken)                  │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│  Get User's Auth Token                  │
│  getStoredToken()                       │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│  Send New Token to Backend              │
│  saveFCMToken(newToken, authToken)      │
│  POST /api/user/fcm-token               │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│  Backend Updates Database               │
│  User.fcm_token = newToken              │
└─────────────────────────────────────────┘
```

## Key Points

1. **Completely Automatic** - No manual action needed
2. **Always Listens** - The `onTokenRefresh` listener is active as long as the hook is mounted
3. **Backend Sync** - New token is automatically sent to backend
4. **No User Interaction** - Happens silently in the background
5. **Error Handling** - Errors are logged but don't break the app

## Why This Matters

- **Old tokens become invalid** - If token refreshes but backend doesn't know, notifications won't work
- **Automatic sync ensures** - Backend always has the latest valid token
- **No manual updates needed** - Everything happens automatically

## Testing Token Refresh

### Simulate Token Refresh

1. **Clear App Data** (Android):
   ```bash
   adb shell pm clear com.mykuttam
   ```
   - App restarts
   - New token is generated
   - New token is automatically sent to backend

2. **Reinstall App**:
   - Uninstall app
   - Reinstall app
   - Login again
   - New token is automatically sent to backend

3. **Check Logs**:
   - Look for: `"FCM token refreshed: ..."`
   - Look for: `"Refreshed FCM token sent to backend"`

## Code Location

- **Token Refresh Listener**: `src/hooks/usePushNotification.ts` (lines 177-195)
- **Send Token Service**: `src/services/notifications.ts` (lines 15-37)
- **Backend Endpoint**: `POST /api/user/fcm-token`

## Important Notes

1. The listener is set up once when the hook initializes
2. It remains active for the lifetime of the component
3. The listener is automatically cleaned up when component unmounts
4. Token refresh can happen at any time (even when app is in background)
5. Backend must handle token updates (update existing token, don't create duplicate)










