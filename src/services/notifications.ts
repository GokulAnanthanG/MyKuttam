import { endpoints } from '../config/api';

/**
 * Service for managing push notifications
 */

export interface SaveFCMTokenResponse {
  success: boolean;
  message: string;
}

/**
 * Save FCM token to backend
 */
export const saveFCMToken = async (fcmToken: string, authToken: string): Promise<SaveFCMTokenResponse> => {
  try {
    const response = await fetch(endpoints.fcmToken, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ fcm_token: fcmToken }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to save FCM token');
    }

    return data;
  } catch (error) {
    console.error('Error saving FCM token:', error);
    throw error;
  }
};

/**
 * Delete FCM token from backend (on logout)
 */
export const deleteFCMToken = async (authToken: string): Promise<SaveFCMTokenResponse> => {
  try {
    const response = await fetch(endpoints.fcmToken, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to delete FCM token');
    }

    return data;
  } catch (error) {
    console.error('Error deleting FCM token:', error);
    throw error;
  }
};






