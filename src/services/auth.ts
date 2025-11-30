import { Alert } from 'react-native';
import { endpoints } from '../config/api';
import { StoredUser } from '../types/user';

type LoginPayload = {
  phone: string;
  password: string;
};

type RegistrationPayload = {
  user: StoredUser;
};

type RequestOtpPayload = {
  phone: string;
};

type ValidateOtpPayload = {
  phone: string;
  OTP: string;
};

type ApiError = {
  message: string;
  status?: number;
};

const handleResponse = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  let data: any = {};
  
  try {
    data = text ? JSON.parse(text) : {};
  } catch (parseError) {
    console.error('Error parsing response:', parseError);
    data = { message: 'Invalid response from server' };
  }

  if (!response.ok) {
    // Extract error message from response
    let errorMessage = 'Something went wrong. Please try again.';
    
    if (data?.message) {
      errorMessage = data.message;
    } else if (data?.error) {
      errorMessage = typeof data.error === 'string' ? data.error : data.error.message || errorMessage;
    } else if (text && !data.message) {
      // If response has text but no parsed message, use the text
      errorMessage = text;
    }

    // Provide user-friendly messages based on status code
    if (response.status === 400) {
      if (!errorMessage || errorMessage === 'Something went wrong. Please try again.') {
        errorMessage = 'Invalid request. Please check your input and try again.';
      }
    } else if (response.status === 401) {
      errorMessage = 'Unauthorized. Please check your credentials.';
    } else if (response.status === 404) {
      errorMessage = 'Resource not found.';
    } else if (response.status >= 500) {
      errorMessage = 'Server error. Please try again later.';
    }

    const error: ApiError = {
      message: errorMessage,
      status: response.status,
    };
    
    console.error('API Error Response:', {
      status: response.status,
      statusText: response.statusText,
      message: errorMessage,
      data: data,
    });
    
    throw error;
  }

  return data as T;
};

type LoginResponse = {
  success: boolean;
  message: string;
  data: {
    token: string;
    user: {
      id: string;
      name: string;
      phone: string;
      dob?: string;
      avatar?: string;
      father_name?: string;
      address?: string;
      account_type: string;
      role: string;
      status?: string;
      report_count?: number;
    };
  };
};

export const AuthService = {
  login: async (payload: LoginPayload) => {
    const response = await fetch(endpoints.login, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await handleResponse<LoginResponse>(response);

    // Map API user to StoredUser format
    const user: StoredUser = {
      id: result.data.user.id,
      phone: result.data.user.phone,
      name: result.data.user.name,
      account_type: result.data.user.account_type as StoredUser['account_type'],
      role: result.data.user.role as StoredUser['role'],
      dob: result.data.user.dob,
      avatar: result.data.user.avatar,
      father_name: result.data.user.father_name,
      address: result.data.user.address,
      status: result.data.user.status as StoredUser['status'],
      report_count: result.data.user.report_count,
    };

    return {
      success: result.success,
      message: result.message,
      token: result.data.token,
      user,
    };
  },

  requestOtp: async (payload: RequestOtpPayload) => {
    const response = await fetch(endpoints.sendOtp, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return handleResponse<{ message?: string }>(response);
  },

  validateOtp: async (payload: ValidateOtpPayload) => {
    // Ensure phone and OTP are not empty
    const phone = payload.phone?.trim() || '';
    const otp = payload.OTP?.trim() || '';
    
    if (!phone || !otp) {
      throw new Error('Phone and OTP are required');
    }

    const requestPayload = {
      phone: phone,
      OTP: otp,
    };

    console.log('AuthService.validateOtp: Calling API with payload:', { phone: requestPayload.phone, OTP: '***' });
    console.log('AuthService.validateOtp: Endpoint:', endpoints.validateOtp);
    console.log('AuthService.validateOtp: Full payload keys:', Object.keys(requestPayload));
    console.log('AuthService.validateOtp: Phone value:', requestPayload.phone);
    console.log('AuthService.validateOtp: OTP length:', requestPayload.OTP.length);
    
    try {
      const response = await fetch(endpoints.validateOtp, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      });

      console.log('AuthService.validateOtp: Response status:', response.status);
      const result = await handleResponse<{
        success: boolean;
        message: string;
        data?: {
          phone: string;
          validated: boolean;
        };
      }>(response);
      console.log('AuthService.validateOtp: Response result:', { success: result.success, validated: result.data?.validated });
      
      return result;
    } catch (error) {
      console.error('AuthService.validateOtp: Fetch error:', error);
      // Re-throw to let the caller handle it
      throw error;
    }
  },

  register: async (payload: RegistrationPayload) => {
    // The API expects the user object to be nested
    const requestBody = {
      user: payload.user,
    };

    const response = await fetch(endpoints.register, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const result = await handleResponse<{
      success: boolean;
      message: string;
      data: {
        token: string;
        user: {
          id: string;
          name: string;
          phone: string;
          dob?: string;
          avatar?: string;
          father_name?: string;
          address?: string;
          account_type: string;
          role: string;
          status?: string;
          report_count?: number;
        };
      };
    }>(response);

    // Map API user to StoredUser format
    const user: StoredUser = {
      id: result.data.user.id,
      phone: result.data.user.phone,
      name: result.data.user.name,
      account_type: result.data.user.account_type as StoredUser['account_type'],
      role: result.data.user.role as StoredUser['role'],
      dob: result.data.user.dob,
      avatar: result.data.user.avatar,
      father_name: result.data.user.father_name,
      address: result.data.user.address,
      status: result.data.user.status as StoredUser['status'],
      report_count: result.data.user.report_count,
    };

    return {
      success: result.success,
      message: result.message,
      token: result.data.token,
      user,
    };
  },

  updateProfile: async (
    token: string,
    updates: Partial<Pick<StoredUser, 'name' | 'dob' | 'father_name' | 'address' | 'avatar'>> & { avatarFile?: { uri: string; type: string; name: string } },
  ) => {
    // Check if we need to send FormData (when avatarFile is present)
    const hasImageFile = updates.avatarFile !== undefined;
    
    let body: FormData | string;
    let headers: Record<string, string>;

    if (hasImageFile) {
      // Create FormData for multipart/form-data
      const formData = new FormData();
      
      // Append text fields
      if (updates.name) {
        formData.append('name', updates.name);
      }
      if (updates.dob) {
        formData.append('dob', updates.dob);
      }
      if (updates.father_name) {
        formData.append('father_name', updates.father_name);
      }
      if (updates.address) {
        formData.append('address', updates.address);
      }

      // Append image file
      if (updates.avatarFile) {
        formData.append('avatar', {
          uri: updates.avatarFile.uri,
          type: updates.avatarFile.type,
          name: updates.avatarFile.name,
        } as any);
      }

      body = formData;
      // Don't set Content-Type for FormData - React Native will set it automatically with boundary
      headers = {
        Authorization: `Bearer ${token}`,
      };
    } else {
      // Regular JSON request (no image file)
      const jsonUpdates = { ...updates };
      delete (jsonUpdates as any).avatarFile; // Remove avatarFile from JSON
      
      body = JSON.stringify(jsonUpdates);
      headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };
    }

    const response = await fetch(endpoints.updateProfile, {
      method: 'PUT',
      headers,
      body,
    });

    const result = await handleResponse<{
      success: boolean;
      message: string;
      data?: {
        user: {
          id: string;
          name: string;
          phone: string;
          dob?: string;
          avatar?: string;
          father_name?: string;
          address?: string;
          account_type: string;
          role: string;
          status?: string;
          report_count?: number;
        };
      };
    }>(response);

    if (result.data?.user) {
      const user: StoredUser = {
        id: result.data.user.id,
        phone: result.data.user.phone,
        name: result.data.user.name,
        account_type: result.data.user.account_type as StoredUser['account_type'],
        role: result.data.user.role as StoredUser['role'],
        dob: result.data.user.dob,
        avatar: result.data.user.avatar,
        father_name: result.data.user.father_name,
        address: result.data.user.address,
        status: result.data.user.status as StoredUser['status'],
        report_count: result.data.user.report_count,
      };
      return { success: result.success, message: result.message, user };
    }

    return { success: result.success, message: result.message, user: null };
  },

  resetPassword: async (
    token: string,
    payload: { currentPassword: string; newPassword: string },
  ) => {
    const response = await fetch(endpoints.resetPassword, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    return handleResponse<{
      success: boolean;
      message: string;
    }>(response);
  },

  forgotPasswordRequestOtp: async (payload: RequestOtpPayload) => {
    const response = await fetch(endpoints.forgotPasswordRequestOtp, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return handleResponse<{
      success: boolean;
      message: string;
      data?: {
        OTP?: string;
      };
    }>(response);
  },

  forgotPasswordReset: async (payload: {
    phone: string;
    OTP: string;
    newPassword: string;
  }) => {
    const response = await fetch(endpoints.forgotPasswordReset, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return handleResponse<{
      success: boolean;
      message: string;
      data?: null;
    }>(response);
  },
};

