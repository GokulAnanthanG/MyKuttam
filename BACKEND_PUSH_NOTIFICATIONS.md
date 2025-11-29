# Backend Push Notification Implementation Guide

This guide explains how to send push notifications from your backend server to the React Native app using Firebase Cloud Messaging (FCM).

## Prerequisites

1. Firebase project with Cloud Messaging enabled
2. Service Account JSON file from Firebase Console
3. FCM tokens stored in your database (sent from the app)

## Step 1: Get Firebase Service Account

1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate New Private Key"
3. Download the JSON file (keep it secure!)
4. Save it in your backend project (e.g., `config/firebase-service-account.json`)

## Step 2: Install Required Packages

```bash
npm install firebase-admin
```

## Step 3: Initialize Firebase Admin SDK

```javascript
// config/firebase-admin.js
const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;
```

## Step 4: Update User Model

Add FCM token fields to your User schema:

```javascript
// models/User.js
const userSchema = new mongoose.Schema({
  // ... existing fields
  fcm_token: {
    type: String,
    default: null,
  },
  fcm_token_updated_at: {
    type: Date,
    default: null,
  },
});
```

## Step 5: Create API Endpoints

### 5.1. Save FCM Token Endpoint

```javascript
// routes/user.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');

// POST /api/user/fcm-token
router.post('/fcm-token', authenticate, async (req, res) => {
  try {
    const { fcm_token } = req.body;
    const userId = req.user.id;

    if (!fcm_token) {
      return res.status(400).json({
        success: false,
        message: 'FCM token is required',
      });
    }

    // Update user's FCM token
    await User.findByIdAndUpdate(userId, {
      fcm_token: fcm_token,
      fcm_token_updated_at: new Date(),
    });

    res.json({
      success: true,
      message: 'FCM token saved successfully',
    });
  } catch (error) {
    console.error('Error saving FCM token:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save FCM token',
    });
  }
});

// DELETE /api/user/fcm-token
router.delete('/fcm-token', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    
    await User.findByIdAndUpdate(userId, {
      fcm_token: null,
      fcm_token_updated_at: null,
    });

    res.json({
      success: true,
      message: 'FCM token deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting FCM token:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete FCM token',
    });
  }
});

module.exports = router;
```

### 5.2. Send Notification Service

```javascript
// services/notification-service.js
const admin = require('../config/firebase-admin');

class NotificationService {
  /**
   * Send notification to a single user
   */
  static async sendToUser(fcmToken, title, body, data = {}) {
    try {
      const message = {
        notification: {
          title: title,
          body: body,
        },
        data: {
          type: String(data.type || 'general'),
          ...Object.keys(data).reduce((acc, key) => {
            acc[key] = String(data[key]);
            return acc;
          }, {}),
        },
        token: fcmToken,
        android: {
          priority: 'high',
          notification: {
            channelId: 'default_channel',
            sound: 'default',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const response = await admin.messaging().send(message);
      return response;
    } catch (error) {
      console.error('Error sending notification:', error);
      throw error;
    }
  }

  /**
   * Send notification to multiple users
   */
  static async sendToMultipleUsers(fcmTokens, title, body, data = {}) {
    try {
      const validTokens = fcmTokens.filter((token) => token);

      if (validTokens.length === 0) {
        throw new Error('No valid FCM tokens provided');
      }

      const message = {
        notification: {
          title: title,
          body: body,
        },
        data: {
          type: String(data.type || 'general'),
          ...Object.keys(data).reduce((acc, key) => {
            acc[key] = String(data[key]);
            return acc;
          }, {}),
        },
        tokens: validTokens,
        android: {
          priority: 'high',
        },
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      return {
        successCount: response.successCount,
        failureCount: response.failureCount,
      };
    } catch (error) {
      console.error('Error sending multicast notification:', error);
      throw error;
    }
  }
}

module.exports = NotificationService;
```

### 5.3. Send Notification Routes

```javascript
// routes/notifications.js
const express = require('express');
const router = express.Router();
const NotificationService = require('../services/notification-service');
const User = require('../models/User');

// POST /api/notifications/send
router.post('/send', authenticate, async (req, res) => {
  try {
    const { userId, title, body, data, type } = req.body;

    // Only admins can send notifications
    if (req.user.role !== 'ADMIN' && req.user.role !== 'SUB_ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const user = await User.findById(userId);
    if (!user || !user.fcm_token) {
      return res.status(404).json({
        success: false,
        message: 'User not found or FCM token not available',
      });
    }

    const messageId = await NotificationService.sendToUser(
      user.fcm_token,
      title,
      body,
      { type, ...data }
    );

    res.json({
      success: true,
      message: 'Notification sent successfully',
      messageId: messageId,
    });
  } catch (error) {
    console.error('Error sending notification:', error);
    
    // Handle invalid token
    if (
      error.code === 'messaging/invalid-registration-token' ||
      error.code === 'messaging/registration-token-not-registered'
    ) {
      await User.findByIdAndUpdate(req.body.userId, {
        fcm_token: null,
        fcm_token_updated_at: null,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to send notification',
      error: error.message,
    });
  }
});

// POST /api/notifications/send-news
router.post('/send-news', authenticate, async (req, res) => {
  try {
    const { newsId, title } = req.body;

    // Get all users with FCM tokens
    const users = await User.find({
      fcm_token: { $ne: null },
    });

    const tokens = users.map((user) => user.fcm_token);

    if (tokens.length === 0) {
      return res.json({
        success: true,
        message: 'No users with FCM tokens found',
        sentCount: 0,
      });
    }

    const response = await NotificationService.sendToMultipleUsers(
      tokens,
      'New News Published',
      title || 'Check out the latest village news',
      {
        type: 'news',
        id: newsId,
      }
    );

    res.json({
      success: true,
      message: `Notification sent to ${response.successCount} users`,
      successCount: response.successCount,
      failureCount: response.failureCount,
    });
  } catch (error) {
    console.error('Error sending news notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send news notification',
    });
  }
});

module.exports = router;
```

## Step 6: Notification Payload Examples

### News Notification
```javascript
{
  notification: {
    title: 'New News Published',
    body: 'Check out the latest village news'
  },
  data: {
    type: 'news',
    id: '123'
  },
  token: userFcmToken
}
```

### Donation Notification
```javascript
{
  notification: {
    title: 'New Donation Received',
    body: '₹500 donated to Education Fund'
  },
  data: {
    type: 'donation',
    categoryId: 'cat123',
    amount: '500'
  },
  token: userFcmToken
}
```

## Step 7: Testing

### Test with cURL
```bash
# Save FCM token
curl -X POST http://localhost:3000/api/user/fcm-token \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"fcm_token": "USER_FCM_TOKEN"}'

# Send notification
curl -X POST http://localhost:3000/api/notifications/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "userId": "USER_ID",
    "title": "Test Notification",
    "body": "This is a test",
    "type": "news",
    "data": {"id": "123"}
  }'
```

## Security Best Practices

1. **Use Service Account** (not Server Key)
2. **Validate user permissions** before sending
3. **Rate limit** notification endpoints
4. **Store tokens securely** in database
5. **Clean up invalid tokens** regularly
6. **Use HTTPS** for all API calls
7. **Authenticate** all notification endpoints



