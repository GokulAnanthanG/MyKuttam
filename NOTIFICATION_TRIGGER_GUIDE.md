# Push Notification Trigger Guide

This guide explains when and how push notifications are triggered in the app.

## Notification Flow Overview

### 1. **App Initialization** (Automatic)

**When:** App starts and user is authenticated

**What happens:**
- `PushNotificationHandler` component initializes
- Checks if notification permissions are granted
- If granted, automatically gets FCM token
- Sends FCM token to backend automatically

**Location:** `App.tsx` → `PushNotificationHandler`

### 2. **Permission Request** (Automatic)

**When:** 
- User logs in for the first time
- User hasn't granted notification permissions yet

**What happens:**
- App automatically requests notification permissions
- If granted, gets FCM token and sends to backend

**Location:** `src/components/PushNotificationHandler.tsx`

### 3. **Token Refresh** (Automatic)

**When:**
- FCM token is refreshed by Firebase
- App is reinstalled
- App data is cleared

**What happens:**
- New token is automatically obtained
- New token is automatically sent to backend
- Old token in backend becomes invalid

**Location:** `src/hooks/usePushNotification.ts` → `onTokenRefresh` listener

### 4. **Foreground Notifications** (When app is open)

**When:** 
- App is open and running in foreground
- Backend sends a push notification

**What happens:**
- Notification is received via `onMessage` listener
- Alert dialog is shown to user
- User can tap "View" to navigate to relevant screen
- User can tap "Cancel" to dismiss

**Location:** `src/hooks/usePushNotification.ts` → `onMessage` handler

**Example:**
```javascript
// Backend sends notification while app is open
// User sees alert: "New Notification" with "View" and "Cancel" buttons
```

### 5. **Background Notifications** (When app is in background)

**When:**
- App is running but in background
- Backend sends a push notification
- User taps the notification

**What happens:**
- Notification appears in system tray
- User taps notification
- App opens and navigates to relevant screen automatically
- `onNotificationOpenedApp` handler is triggered

**Location:** `src/hooks/usePushNotification.ts` → `onNotificationOpenedApp` handler

**Example:**
```javascript
// Backend sends notification
// User sees notification in system tray
// User taps notification
// App opens and navigates to news/donation/gallery screen
```

### 6. **Closed App Notifications** (When app is closed)

**When:**
- App is completely closed/killed
- Backend sends a push notification
- User taps the notification

**What happens:**
- Notification appears in system tray
- User taps notification
- App launches and navigates to relevant screen automatically
- `getInitialNotification` handler is triggered

**Location:** `src/hooks/usePushNotification.ts` → `getInitialNotification` handler

**Example:**
```javascript
// Backend sends notification
// User sees notification in system tray
// User taps notification
// App launches and navigates to news/donation/gallery screen
```

### 7. **App State Change** (When app comes to foreground)

**When:**
- App was in background
- User brings app to foreground
- There was a pending notification

**What happens:**
- App checks for pending notifications
- If found, navigates to relevant screen

**Location:** `src/hooks/usePushNotification.ts` → `AppState` listener

## Notification Navigation Triggers

Notifications automatically navigate based on `type` in the data payload:

### News Notification
```json
{
  "notification": {
    "title": "New News",
    "body": "Check out latest news"
  },
  "data": {
    "type": "news",
    "id": "123"
  }
}
```
**Triggers:** Navigation to Home screen with newsId

### Donation Notification
```json
{
  "notification": {
    "title": "New Donation",
    "body": "Donation received"
  },
  "data": {
    "type": "donation"
  }
}
```
**Triggers:** Navigation to Donation screen

### Gallery Notification
```json
{
  "notification": {
    "title": "New Photo",
    "body": "Photo added to gallery"
  },
  "data": {
    "type": "gallery"
  }
}
```
**Triggers:** Navigation to Gallery screen

## When to Send Notifications from Backend

### 1. **When News is Published**
```javascript
// In your news creation endpoint
router.post('/news', async (req, res) => {
  // ... create news ...
  
  // Send notification to all users
  await NotificationService.sendToMultipleUsers(
    allUserTokens,
    'New News Published',
    newsData.title,
    {
      type: 'news',
      id: newsData.id,
    }
  );
});
```

### 2. **When Donation is Received**
```javascript
// In your donation creation endpoint
router.post('/donations', async (req, res) => {
  // ... create donation ...
  
  // Send notification to donation manager
  await NotificationService.sendToUser(
    managerFcmToken,
    'New Donation Received',
    `₹${amount} donated to ${categoryName}`,
    {
      type: 'donation',
      categoryId: categoryId,
    }
  );
});
```

### 3. **When Photo is Added to Gallery**
```javascript
// In your gallery upload endpoint
router.post('/gallery/upload', async (req, res) => {
  // ... upload photo ...
  
  // Send notification to all users
  await NotificationService.sendToMultipleUsers(
    allUserTokens,
    'New Photo Added',
    'A new photo has been added to the gallery',
    {
      type: 'gallery',
      imageId: imageData.id,
    }
  );
});
```

### 4. **Scheduled Notifications**
```javascript
// Using cron job or scheduled task
cron.schedule('0 9 * * *', async () => {
  // Send daily news summary at 9 AM
  await NotificationService.sendToMultipleUsers(
    allUserTokens,
    'Daily News Summary',
    'Check out today\'s village news',
    {
      type: 'news',
    }
  );
});
```

## Complete Notification Lifecycle

```
1. User logs in
   ↓
2. App requests notification permission
   ↓
3. Permission granted → Get FCM token
   ↓
4. Send FCM token to backend
   ↓
5. Backend stores FCM token in database
   ↓
6. Backend sends notification (when event occurs)
   ↓
7. Firebase delivers notification to device
   ↓
8. App receives notification:
   - If foreground → Show alert
   - If background → Show in system tray
   - If closed → Show in system tray
   ↓
9. User taps notification
   ↓
10. App navigates to relevant screen
```

## Testing Notifications

### Test Foreground Notification
1. Open the app
2. Send notification from backend
3. Alert should appear immediately

### Test Background Notification
1. Put app in background (press home button)
2. Send notification from backend
3. Notification appears in system tray
4. Tap notification
5. App opens and navigates

### Test Closed App Notification
1. Close/kill the app completely
2. Send notification from backend
3. Notification appears in system tray
4. Tap notification
5. App launches and navigates

## Important Notes

1. **Token is sent automatically** - No manual action needed
2. **Permissions are requested automatically** - On first login
3. **Token refresh is handled automatically** - No manual action needed
4. **Navigation is automatic** - Based on notification data type
5. **Backend must send notifications** - App only receives them

## Backend Trigger Examples

### Trigger on News Creation
```javascript
// After creating news
if (newsCreated) {
  await sendNewsNotification(newsId, newsTitle);
}
```

### Trigger on Donation
```javascript
// After receiving donation
if (donationReceived) {
  await sendDonationNotification(managerId, amount, category);
}
```

### Trigger on Gallery Upload
```javascript
// After uploading photo
if (photoUploaded) {
  await sendGalleryNotification(imageId);
}
```










