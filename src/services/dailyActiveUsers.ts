import { BASE_URL } from '../config/api';
import { getStoredToken } from '../storage/userRealm';

export type DailyActiveUser = {
  id: string;
  user_id: string;
  date: string;
  createdAt: string;
  isNewRecord?: boolean;
};

export type DailyActiveUserCount = {
  date: string;
  count: number;
};

export type DailyActiveUserCountRange = {
  startDate: string;
  endDate: string;
  dailyCounts: {
    date: string;
    count: number;
  }[];
};

export type ActiveUser = {
  id: string;
  name: string;
  avatar?: string;
  address?: string;
  father_name?: string;
  phone: string;
};

export type DailyActiveUserResponse<T> = {
  success: boolean;
  message: string;
  data: T | null;
};

export type UsersListResponse = {
  users: ActiveUser[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export class DailyActiveUserService {
  /**
   * Record the authenticated user as active for today
   */
  static async recordActiveUser(): Promise<DailyActiveUserResponse<DailyActiveUser>> {
    try {
      const token = await getStoredToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${BASE_URL}/api/daily-active-users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      return data;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to record daily active user',
        data: null,
      };
    }
  }

  /**
   * Get daily active user count for a specific date (defaults to today)
   */
  static async getDailyCount(date?: string): Promise<DailyActiveUserResponse<DailyActiveUserCount>> {
    try {
      const url = date
        ? `${BASE_URL}/api/daily-active-users/count?date=${encodeURIComponent(date)}`
        : `${BASE_URL}/api/daily-active-users/count`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      return data;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get daily active user count',
        data: null,
      };
    }
  }

  /**
   * Get daily active user counts for a date range
   */
  static async getDailyCountRange(
    startDate: string,
    endDate: string,
  ): Promise<DailyActiveUserResponse<DailyActiveUserCountRange>> {
    try {
      const url = `${BASE_URL}/api/daily-active-users/count/range?startDate=${encodeURIComponent(
        startDate,
      )}&endDate=${encodeURIComponent(endDate)}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      return data;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get daily active user count range',
        data: null,
      };
    }
  }

  /**
   * List users with pagination and filters
   */
  static async listUsers(params?: {
    page?: number;
    limit?: number;
    status?: string;
    account_type?: string;
    role?: string;
  }): Promise<DailyActiveUserResponse<UsersListResponse>> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.status) queryParams.append('status', params.status);
      if (params?.account_type) queryParams.append('account_type', params.account_type);
      if (params?.role) queryParams.append('role', params.role);

      const url = `${BASE_URL}/api/daily-active-users/users${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      return data;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to list users',
        data: null,
      };
    }
  }

  /**
   * Get active users with details for a specific date
   * Returns users who were active on the given date with full details (name, phone, avatar, father_name, address)
   */
  static async getActiveUsersWithDetails(params?: {
    date?: string;
    page?: number;
    limit?: number;
  }): Promise<DailyActiveUserResponse<UsersListResponse>> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.date) queryParams.append('date', params.date);
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());

      const url = `${BASE_URL}/api/daily-active-users/active-users${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      return data;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get active users with details',
        data: null,
      };
    }
  }
}

