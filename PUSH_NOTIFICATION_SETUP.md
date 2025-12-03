# Push Notification Setup Guide

Complete guide to set up Firebase Cloud Messaging (FCM) push notifications in your React Native app.

## Installation

### 1. Install Required Packages

```bash
npm install @react-native-firebase/app @react-native-firebase/messaging
```

### 2. iOS Setup (if needed)

For iOS, you'll need to:
1. Add Firebase to your iOS project
2. Add `GoogleService-Info.plist` to your iOS project
3. Enable Push Notifications capability in Xcode
4. Configure APNs (Apple Push Notification service)

### 3. Android Setup

✅ Already configured:
- `google-services.json` is in place
- Firebase Messaging dependency added to `build.gradle`
- Permissions added to `AndroidManifest.xml`
- FCM service configured

### 4. Rebuild the App

After installing packages, rebuild:

```bash
# Clean and rebuild
cd android && ./gradlew clean && cd ..
npm run android
```

## How It Works

### Automatic Initialization

The `PushNotificationHandler` component (added to `App.tsx`) automatically:
- Requests notification permissions when user logs in
- Gets FCM token
- Sends token to backend automatically
- Handles token refresh
- Handles foreground/background notifications
- Handles notification taps with navigation

### Manual Usage

You can also use the hook manually in any component:

```typescript
import { usePushNotification } from '../hooks/usePushNotification';

const MyComponent = () => {
  const {
    fcmToken,
    isLoading,
    isPermissionGranted,
    requestPermission,
  } = usePushNotification();

  // Use the hook...
};
```

## Backend Integration

The app automatically sends the FCM token to your backend when:
- User logs in
- Token is refreshed
- App starts (if user is authenticated)

### Backend Endpoints Required

1. **POST /api/user/fcm-token** - Save FCM token
   ```json
   {
     "fcm_token": "USER_FCM_TOKEN"
   }
   ```

2. **DELETE /api/user/fcm-token** - Delete FCM token (on logout)

See `BACKEND_PUSH_NOTIFICATIONS.md` for complete backend implementation.

## Notification Types

The app handles these notification types automatically:
- `news` - Navigates to news detail
- `donation` - Navigates to donation screen
- `gallery` - Navigates to gallery screen
- Default - Navigates to home

## Testing

1. **Get FCM Token**: Check console logs for "FCM Token: ..."
2. **Test from Firebase Console**:
   - Go to Firebase Console > Cloud Messaging
   - Click "Send test message"
   - Enter the FCM token
   - Send a test notification

3. **Test from Backend**: Use the backend API to send notifications

## Troubleshooting

### Token not generated
- Check if permissions are granted
- Verify `google-services.json` is correct
- Check device/emulator has Google Play Services

### Notifications not received
- Verify FCM token is sent to backend
- Check notification payload format
- Verify app has notification permissions
- Check notification channel settings (Android)

### Navigation not working
- Ensure navigation is properly set up
- Check notification data payload format
- Verify screen names match your navigation structure










