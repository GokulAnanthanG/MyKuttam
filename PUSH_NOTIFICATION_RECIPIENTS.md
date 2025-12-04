# Push Notification Recipients - Who Receives Notifications?

## ❌ Not All Users Automatically Receive Notifications

Users need to meet certain conditions to receive push notifications.

## ✅ Conditions for Receiving Notifications

A user will receive push notifications **ONLY if**:

1. ✅ **App is Installed** - User has downloaded and installed the app
2. ✅ **Notification Permission Granted** - User has allowed notifications
3. ✅ **FCM Token Generated** - App has generated an FCM token
4. ✅ **Token Sent to Backend** - FCM token is stored in your backend database
5. ✅ **Backend Sends Notification** - Your backend sends notification to that token

## 📊 User Categories

### Category 1: Will Receive Notifications ✅
- App installed
- Permission granted
- FCM token in database
- Backend sends notification to their token

### Category 2: Will NOT Receive Notifications ❌
- App not installed
- Permission denied
- FCM token not in database
- Token expired/invalid
- Backend doesn't send to their token

## 🔔 How to Send to All Users

### Option 1: Send to All Users with FCM Tokens

```javascript
// Get all users who have FCM tokens
const users = await User.find({
  fcm_token: { $ne: null }, // Token exists
});

const tokens = users.map((user) => user.fcm_token);

// Send to all
await NotificationService.sendToMultipleUsers(
  tokens,
  'New News Published',
  'Check out the latest village news',
  {
    type: 'news',
    id: newsId,
  }
);
```

### Option 2: Send to Specific Users

```javascript
// Send to specific user
const user = await User.findById(userId);
if (user && user.fcm_token) {
  await NotificationService.sendToUser(
    user.fcm_token,
    'New Donation Received',
    'You have a new donation',
    {
      type: 'donation',
    }
  );
}
```

### Option 3: Send to User Group

```javascript
// Send to all managers
const managers = await User.find({
  role: { $in: ['ADMIN', 'SUB_ADMIN', 'DONATION_MANAGER'] },
  fcm_token: { $ne: null },
});

const tokens = managers.map((user) => user.fcm_token);
await NotificationService.sendToMultipleUsers(tokens, title, body, data);
```

## 📈 User Coverage Statistics

To check how many users can receive notifications:

```javascript
// Get statistics
const totalUsers = await User.countDocuments();
const usersWithTokens = await User.countDocuments({
  fcm_token: { $ne: null },
});
const usersWithoutTokens = totalUsers - usersWithTokens;

console.log(`Total users: ${totalUsers}`);
console.log(`Users with FCM tokens: ${usersWithTokens}`);
console.log(`Users without FCM tokens: ${usersWithoutTokens}`);
console.log(`Coverage: ${(usersWithTokens / totalUsers * 100).toFixed(2)}%`);
```

## 🎯 Best Practices

### 1. Always Check for Tokens
```javascript
// Don't send if no tokens
const users = await User.find({ fcm_token: { $ne: null } });
if (users.length === 0) {
  console.log('No users with FCM tokens');
  return;
}
```

### 2. Handle Failures Gracefully
```javascript
// Don't fail main operation if notification fails
try {
  await sendNotification();
} catch (error) {
  console.error('Notification failed:', error);
  // Continue with main operation
}
```

### 3. Clean Up Invalid Tokens
```javascript
// Remove invalid tokens
if (error.code === 'messaging/invalid-registration-token') {
  await User.findByIdAndUpdate(userId, {
    fcm_token: null,
  });
}
```

## 📋 Notification Recipient Checklist

Before sending notification, check:

- [ ] User has app installed
- [ ] User granted notification permission
- [ ] FCM token exists in database
- [ ] Token is valid (not expired)
- [ ] Backend sends notification to that token

## 🔍 How to Increase Coverage

### 1. Request Permissions on Login
✅ Already implemented - App requests permission automatically

### 2. Remind Users to Enable Notifications
- Show in-app message if permission denied
- Guide users to enable in settings

### 3. Handle Token Refresh
✅ Already implemented - Token refresh is automatic

### 4. Re-request Permission
- If user denied, show option to enable later
- Guide to device settings

## 💡 Example: Send News to All Users

```javascript
// Complete example
router.post('/news', async (req, res) => {
  try {
    // Create news
    const news = await News.create(req.body);

    // Send notification to ALL users with tokens
    const users = await User.find({
      fcm_token: { $ne: null },
    });

    if (users.length > 0) {
      const tokens = users.map((user) => user.fcm_token);

      const result = await NotificationService.sendToMultipleUsers(
        tokens,
        'New News Published',
        news.title,
        {
          type: 'news',
          id: news._id.toString(),
        }
      );

      console.log(`Sent to ${result.successCount} users`);
      console.log(`Failed: ${result.failureCount} users`);
    }

    res.json({ success: true, data: news });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
```

## 🚨 Important Notes

1. **Not Everyone Gets Notifications** - Only users who:
   - Installed app
   - Granted permission
   - Have valid FCM token in database

2. **Token Required** - Backend must have user's FCM token to send

3. **Permission Required** - User must grant notification permission

4. **Token Can Expire** - Old tokens become invalid, need refresh

5. **Backend Must Send** - App doesn't automatically send, backend triggers it

## 📊 Expected Coverage

Typical coverage rates:
- **100% of users with app installed** - If all granted permission
- **70-90% coverage** - Realistic (some deny permission)
- **0% coverage** - If backend doesn't send notifications

## ✅ Summary

**Answer: NO, not all users automatically receive notifications.**

Users receive notifications **ONLY if**:
1. They have the app installed
2. They granted notification permission
3. Their FCM token is stored in your backend
4. Your backend sends a notification to their token

To send to all eligible users, your backend must:
1. Query all users with FCM tokens
2. Send notification to all those tokens
3. Handle failures gracefully











