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

    return handleResponse<{
      user?: StoredUser;
      token?: string;
      [key: string]: unknown;
    }>(response);
  },
};

