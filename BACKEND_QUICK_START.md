# Backend Quick Start Guide

Complete step-by-step implementation for push notifications in your backend.

## Step 1: Install Firebase Admin SDK

```bash
npm install firebase-admin
```

## Step 2: Initialize Firebase Admin

Create `config/firebase-admin.js`:

```javascript
const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;
```

**Important**: 
- Download service account JSON from Firebase Console
- Add `firebase-service-account.json` to `.gitignore`
- Never commit this file to git

## Step 3: Update User Model

Add FCM token fields to your User schema:

```javascript
// models/User.js (Mongoose example)
const userSchema = new mongoose.Schema({
  // ... existing fields
  phone: String,
  name: String,
  // ... other fields
  
  // Add these fields:
  fcm_token: {
    type: String,
    default: null,
  },
  fcm_token_updated_at: {
    type: Date,
    default: null,
  },
});

module.exports = mongoose.model('User', userSchema);
```

## Step 4: Create FCM Token Endpoints

Create `routes/user.js` or add to existing user routes:

```javascript
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authenticate } = require('../middleware/auth'); // Your auth middleware

// POST /api/user/fcm-token
router.post('/fcm-token', authenticate, async (req, res) => {
  try {
    const { fcm_token } = req.body;
    const userId = req.user.id; // From auth middleware

    if (!fcm_token) {
      return res.status(400).json({
        success: false,
        message: 'FCM token is required',
      });
    }

    // Validate token format (basic check)
    if (typeof fcm_token !== 'string' || fcm_token.length < 100) {
      return res.status(400).json({
        success: false,
        message: 'Invalid FCM token format',
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

## Step 5: Create Notification Service

Create `services/notification-service.js`:

```javascript
const admin = require('../config/firebase-admin');

class NotificationService {
  /**
   * Send notification to a single user
   */
  static async sendToUser(fcmToken, title, body, data = {}) {
    try {
      // Convert all data values to strings (FCM requirement)
      const stringifiedData = {};
      for (const key in data) {
        if (data.hasOwnProperty(key)) {
          stringifiedData[key] = String(data[key]);
        }
      }

      const message = {
        notification: {
          title: title,
          body: body,
        },
        data: {
          type: String(data.type || 'general'),
          ...stringifiedData,
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
      // Filter out null/undefined tokens
      const validTokens = fcmTokens.filter((token) => token);

      if (validTokens.length === 0) {
        throw new Error('No valid FCM tokens provided');
      }

      // Convert all data values to strings
      const stringifiedData = {};
      for (const key in data) {
        if (data.hasOwnProperty(key)) {
          stringifiedData[key] = String(data[key]);
        }
      }

      const message = {
        notification: {
          title: title,
          body: body,
        },
        data: {
          type: String(data.type || 'general'),
          ...stringifiedData,
        },
        tokens: validTokens,
        android: {
          priority: 'high',
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
            },
          },
        },
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      
      return {
        successCount: response.successCount,
        failureCount: response.failureCount,
        responses: response.responses,
      };
    } catch (error) {
      console.error('Error sending multicast notification:', error);
      throw error;
    }
  }

  /**
   * Handle invalid tokens and clean up
   */
  static async handleInvalidTokens(userIds, responses) {
    const User = require('../models/User');
    
    for (let i = 0; i < responses.length; i++) {
      const response = responses[i];
      if (!response.success) {
        const error = response.error;
        if (
          error.code === 'messaging/invalid-registration-token' ||
          error.code === 'messaging/registration-token-not-registered'
        ) {
          // Remove invalid token
          await User.findByIdAndUpdate(userIds[i], {
            fcm_token: null,
            fcm_token_updated_at: null,
          });
        }
      }
    }
  }
}

module.exports = NotificationService;
```

## Step 6: Integrate with News Creation

Update your news creation endpoint:

```javascript
// routes/news.js
const NotificationService = require('../services/notification-service');
const User = require('../models/User');

router.post('/news', authenticate, async (req, res) => {
  try {
    // ... create news logic ...
    const news = await News.create(newsData);

    // Send notification to all users
    try {
      const users = await User.find({
        fcm_token: { $ne: null },
      });

      const tokens = users.map((user) => user.fcm_token);

      if (tokens.length > 0) {
        await NotificationService.sendToMultipleUsers(
          tokens,
          'New News Published',
          news.title,
          {
            type: 'news',
            id: news._id.toString(),
          }
        );
      }
    } catch (notifError) {
      // Don't fail news creation if notification fails
      console.error('Error sending news notification:', notifError);
    }

    res.json({
      success: true,
      message: 'News created successfully',
      data: news,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create news',
    });
  }
});
```

## Step 7: Integrate with Donation Creation

Update your donation creation endpoint:

```javascript
// routes/donations.js
const NotificationService = require('../services/notification-service');
const User = require('../models/User');

router.post('/donations', authenticate, async (req, res) => {
  try {
    // ... create donation logic ...
    const donation = await Donation.create(donationData);

    // Send notification to donation manager
    try {
      const manager = await User.findById(donation.manager_id);
      
      if (manager && manager.fcm_token) {
        await NotificationService.sendToUser(
          manager.fcm_token,
          'New Donation Received',
          `₹${donation.amount} donated to ${donation.category_name}`,
          {
            type: 'donation',
            categoryId: donation.category_id.toString(),
            amount: donation.amount.toString(),
          }
        );
      }
    } catch (notifError) {
      console.error('Error sending donation notification:', notifError);
    }

    res.json({
      success: true,
      message: 'Donation created successfully',
      data: donation,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create donation',
    });
  }
});
```

## Step 8: Integrate with Gallery Upload

Update your gallery upload endpoint:

```javascript
// routes/gallery.js
const NotificationService = require('../services/notification-service');
const User = require('../models/User');

router.post('/gallery/upload', authenticate, async (req, res) => {
  try {
    // ... upload image logic ...
    const image = await GalleryImage.create(imageData);

    // Send notification to all users
    try {
      const users = await User.find({
        fcm_token: { $ne: null },
      });

      const tokens = users.map((user) => user.fcm_token);

      if (tokens.length > 0) {
        await NotificationService.sendToMultipleUsers(
          tokens,
          'New Photo Added',
          'A new photo has been added to the gallery',
          {
            type: 'gallery',
            imageId: image._id.toString(),
          }
        );
      }
    } catch (notifError) {
      console.error('Error sending gallery notification:', notifError);
    }

    res.json({
      success: true,
      message: 'Image uploaded successfully',
      data: image,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to upload image',
    });
  }
});
```

## Step 9: Register Routes

Add routes to your main app file:

```javascript
// app.js or server.js
const userRoutes = require('./routes/user');
const notificationRoutes = require('./routes/notifications'); // Optional

app.use('/api/user', userRoutes);
app.use('/api/notifications', notificationRoutes); // Optional
```

## Step 10: Test Implementation

### Test 1: Save FCM Token
```bash
curl -X POST http://localhost:3000/api/user/fcm-token \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{"fcm_token": "USER_FCM_TOKEN_FROM_APP"}'
```

### Test 2: Send Notification
```bash
curl -X POST http://localhost:3000/api/notifications/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "userId": "USER_ID",
    "title": "Test Notification",
    "body": "This is a test",
    "type": "news",
    "data": {"id": "123"}
  }'
```

## File Structure

```
backend/
├── config/
│   ├── firebase-admin.js          ← Step 2
│   └── firebase-service-account.json  ← Step 2 (download from Firebase)
├── models/
│   └── User.js                    ← Step 3 (update schema)
├── services/
│   └── notification-service.js    ← Step 5
├── routes/
│   ├── user.js                    ← Step 4 (add FCM token endpoints)
│   ├── news.js                    ← Step 6 (integrate notifications)
│   ├── donations.js                ← Step 7 (integrate notifications)
│   └── gallery.js                  ← Step 8 (integrate notifications)
└── app.js                          ← Step 9 (register routes)
```

## Important Notes

1. **Service Account JSON**: Keep it secure, never commit to git
2. **Token Validation**: Always validate FCM token format
3. **Error Handling**: Don't fail main operations if notifications fail
4. **Token Cleanup**: Remove invalid tokens from database
5. **Update vs Create**: Update existing token, don't create duplicates

## Common Issues & Solutions

### Issue: "Invalid registration token"
**Solution**: Token is expired/invalid, remove from database

### Issue: "Permission denied"
**Solution**: Check Firebase service account permissions

### Issue: "Token not found"
**Solution**: User hasn't sent FCM token yet, wait for app to send it

### Issue: Notifications not received
**Solution**: 
- Check if token is valid in database
- Verify notification payload format
- Check Firebase Console for delivery status











