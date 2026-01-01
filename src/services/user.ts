import { endpoints } from '../config/api';
import { UserRole } from '../types/user';

const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const { getStoredToken } = await import('../storage/userRealm');
  const token = await getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

type UpdateUserRoleResponse = {
  success: boolean;
  message: string;
  data: {
    user: {
      _id: string;
      name: string;
      phone: string;
      dob?: string;
      avatar?: string;
      father_name?: string;
      address?: string;
      account_type: 'COMMON' | 'MANAGEMENT';
      role: UserRole[];
      status: string;
      report_count: number;
      fcm_token?: string | null;
      fcm_token_updated_at?: string | null;
      createdAt: string;
      updatedAt: string;
    };
  } | null;
};

export const UserService = {
  // Update user role by phone number
  updateUserRole: async (phone: string, roles: UserRole[]): Promise<UpdateUserRoleResponse> => {
    const headers = await getAuthHeaders();
    const response = await fetch(endpoints.updateUserRole(phone), {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        role: roles,
      }),
    });

    const text = await response.text();
    const data: UpdateUserRoleResponse = text
      ? JSON.parse(text)
      : { success: false, message: 'Empty response', data: null };

    if (!response.ok) {
      throw new Error(data.message || 'Failed to update user role');
    }

    return data;
  },
};

