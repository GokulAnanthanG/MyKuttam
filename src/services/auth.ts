import { Alert } from 'react-native';
import { endpoints } from '../config/api';
import { StoredUser } from '../types/user';

type LoginPayload = {
  phone: string;
  password: string;
};

type RegistrationPayload = {
  user: StoredUser;
  OTP: string;
};

type RequestOtpPayload = {
  phone: string;
};

type ApiError = {
  message: string;
  status?: number;
};

const handleResponse = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  const data = text ? (JSON.parse(text) as T) : ({} as T);

  if (!response.ok) {
    const error: ApiError = {
      message:
        (data as { message?: string })?.message ??
        'Something went wrong. Please try again.',
      status: response.status,
    };
    throw error;
  }

  return data;
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

  register: async (payload: RegistrationPayload) => {
    const response = await fetch(endpoints.register, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
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

