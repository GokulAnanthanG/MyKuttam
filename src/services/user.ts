import { endpoints } from '../config/api';
import { UserRole, AccountStatus, AccountType } from '../types/user';

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

export type User = {
  id: string;
  name: string;
  phone: string;
  dob?: string;
  avatar?: string;
  father_name?: string;
  address?: string;
  status: AccountStatus;
  report_count: number;
  account_type: AccountType;
  role: UserRole[];
  fcm_token?: string | null;
  createdAt: string;
  updatedAt: string;
};

type GetUsersParams = {
  page?: number;
  limit?: number;
  status?: AccountStatus;
  account_type?: AccountType;
  role?: UserRole;
};

type GetUsersResponse = {
  success: boolean;
  message: string;
  data: {
    users: User[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
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

  // Get all users with pagination and filters
  getUsers: async (params: GetUsersParams = {}): Promise<GetUsersResponse> => {
    const headers = await getAuthHeaders();
    const queryParams = new URLSearchParams();
    
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.status) queryParams.append('status', params.status);
    if (params.account_type) queryParams.append('account_type', params.account_type);
    if (params.role) queryParams.append('role', params.role);

    const url = `${endpoints.users}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    const text = await response.text();
    const data: GetUsersResponse = text
      ? JSON.parse(text)
      : { success: false, message: 'Empty response', data: null };

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch users');
    }

    return data;
  },
};

