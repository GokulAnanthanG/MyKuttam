# Push Notification Triggers - Quick Reference

## 🔔 When Notifications Are Received

### 1. **Foreground (App is Open)**
**Trigger:** Backend sends notification while app is running
**Action:** Alert dialog appears immediately
**User Action:** Tap "View" to navigate or "Cancel" to dismiss

### 2. **Background (App is Minimized)**
**Trigger:** Backend sends notification while app is in background
**Action:** Notification appears in system tray
**User Action:** Tap notification → App opens and navigates automatically

### 3. **Closed (App is Killed)**
**Trigger:** Backend sends notification while app is closed
**Action:** Notification appears in system tray
**User Action:** Tap notification → App launches and navigates automatically

## ⚡ Automatic Triggers (No Backend Action Needed)

### 1. **App Starts + User Logged In**
- ✅ Checks notification permissions
- ✅ Gets FCM token automatically
- ✅ Sends token to backend automatically

### 2. **User Logs In**
- ✅ Requests notification permission (if not granted)
- ✅ Gets FCM token automatically
- ✅ Sends token to backend automatically

### 3. **Token Refresh**
- ✅ Firebase refreshes token automatically
- ✅ New token sent to backend automatically

### 4. **User Logs Out**
- ✅ FCM token deleted from backend automatically
- ✅ Local token cleared

## 📤 When Backend Should Send Notifications

### 1. **News Published**
```javascript
// After creating news
POST /api/news → Create news → Send notification to all users
```

### 2. **Donation Received**
```javascript
// After receiving donation
POST /api/donations → Create donation → Send notification to manager
```

### 3. **Photo Uploaded**
```javascript
// After uploading photo
POST /api/gallery/upload → Upload photo → Send notification to all users
```

### 4. **Scheduled Events**
```javascript
// Using cron jobs
Daily at 9 AM → Send daily news summary
Weekly → Send donation summary
```

## 🎯 Notification Navigation Triggers

Notifications automatically navigate based on `data.type`:

| Type | Navigation Target |
|------|------------------|
| `news` | Home screen (with newsId if provided) |
| `donation` | Donation screen |
| `gallery` | Gallery screen |
| `default` | Home screen |

## 📋 Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    USER LOGS IN                          │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│         REQUEST NOTIFICATION PERMISSION                 │
│         (Automatic - PushNotificationHandler)            │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              GET FCM TOKEN                               │
│              (Automatic - usePushNotification hook)     │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│         SEND TOKEN TO BACKEND                            │
│         POST /api/user/fcm-token                         │
│         (Automatic - saveFCMToken service)               │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│         BACKEND STORES TOKEN IN DATABASE                │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│         BACKEND SENDS NOTIFICATION                       │
│         (When event occurs - News/Donation/Gallery)     │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│         FIREBASE DELIVERS TO DEVICE                      │
└────────────────────┬────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│  APP FOREGROUND  │    │ APP BACKGROUND  │
│  Show Alert     │    │ Show in Tray    │
│  User taps View │    │ User taps Notif │
└────────┬────────┘    └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│         NAVIGATE TO RELEVANT SCREEN                      │
│         (Automatic - handleNotificationNavigation)       │
└─────────────────────────────────────────────────────────┘
```

## 🔍 Key Points

1. **App-side is automatic** - No manual triggers needed
2. **Backend must send** - App only receives notifications
3. **Navigation is automatic** - Based on notification data type
4. **Token management is automatic** - Get, refresh, delete all handled
5. **Permissions are automatic** - Requested on login

## 🧪 Testing Checklist

- [ ] App requests permission on login
- [ ] FCM token is generated
- [ ] Token is sent to backend
- [ ] Foreground notification shows alert
- [ ] Background notification appears in tray
- [ ] Closed app notification appears in tray
- [ ] Tapping notification navigates correctly
- [ ] Token refresh updates backend
- [ ] Logout deletes token from backend







