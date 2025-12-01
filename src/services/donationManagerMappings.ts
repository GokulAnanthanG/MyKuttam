import { endpoints } from '../config/api';

export type DonationManager = {
  id: string;
  name: string;
  phone: string;
  avatar?: string | null;
  role: 'DONATION_MANAGER';
  account_type: 'MANAGEMENT';
  status: 'ACTIVE' | 'SUSPENDED' | 'BLOCK';
  createdAt: string;
  updatedAt: string;
};

export type DonationManagerMapping = {
  id: string;
  donation_manager: {
    _id: string;
    name: string;
    phone: string;
    avatar?: string | null;
    role: 'DONATION_MANAGER';
    account_type: 'MANAGEMENT';
  };
  subcategory: {
    _id: string;
    title: string;
    description?: string;
    type: string;
    amount?: number;
  };
  paymentMethod?: 'UPI' | 'BANK_ACCOUNT';
  paymentImage?: string | null;
  accountHolderName?: string | null;
  createdBy: string;
  createdAt: string;
};

export type DonationManagersListResponse = {
  success: boolean;
  message: string;
  data: {
    donation_managers: DonationManager[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  } | null;
};

export type DonationManagerWithMapping = DonationManager & {
  mappedAt: string;
  paymentMethod?: 'UPI' | 'BANK_ACCOUNT';
  paymentImage?: string | null;
  accountHolderName?: string | null;
};

export type DonationManagersBySubcategoryResponse = {
  success: boolean;
  message: string;
  data: {
    subcategory: {
      id: string;
      title: string;
      description?: string;
      type: string;
      amount?: number;
    };
    donation_managers: DonationManagerWithMapping[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  } | null;
};

export type MappingsListResponse = {
  success: boolean;
  message: string;
  data: {
    mappings: DonationManagerMapping[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  } | null;
};

export type CreateMappingPayload = {
  donation_manager_id: string;
  subcategory_id: string;
  paymentMethod?: 'UPI' | 'BANK_ACCOUNT';
  paymentImage?: string;
  accountHolderName?: string;
};

export type DeleteMappingPayload = {
  donation_manager_id: string;
  subcategory_id: string;
};

export type MappingResponse = {
  success: boolean;
  message: string;
  data: DonationManagerMapping | null;
};

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

const buildQueryString = (params?: Record<string, string | number | undefined>) => {
  if (!params) {
    return '';
  }
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.append(key, String(value));
    }
  });
  const queryString = query.toString();
  return queryString ? `?${queryString}` : '';
};

export const DonationManagerMappingService = {
  getDonationManagers: async (params?: {
    page?: number;
    limit?: number;
  }): Promise<DonationManagersListResponse> => {
    const headers = await getAuthHeaders();
    const query = buildQueryString(params);
    const response = await fetch(`${endpoints.donationManagers}${query}`, {
      method: 'GET',
      headers,
    });

    const text = await response.text();
    const data: DonationManagersListResponse = text
      ? JSON.parse(text)
      : { success: false, message: 'Empty response', data: null };

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch donation managers');
    }

    return data;
  },

  getMappings: async (params?: {
    donation_manager_id?: string;
    subcategory_id?: string;
    page?: number;
    limit?: number;
  }): Promise<MappingsListResponse> => {
    const headers = await getAuthHeaders();
    const query = buildQueryString(params);
    const response = await fetch(`${endpoints.donationManagerMappings}${query}`, {
      method: 'GET',
      headers,
    });

    const text = await response.text();
    const data: MappingsListResponse = text
      ? JSON.parse(text)
      : { success: false, message: 'Empty response', data: null };

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch mappings');
    }

    return data;
  },

  createMapping: async (payload: CreateMappingPayload): Promise<MappingResponse> => {
    const headers = await getAuthHeaders();
    const response = await fetch(endpoints.donationManagerMappings, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    const data: MappingResponse = text
      ? JSON.parse(text)
      : { success: false, message: 'Empty response', data: null };

    if (!response.ok) {
      throw new Error(data.message || 'Failed to create mapping');
    }

    return data;
  },

  deleteMapping: async (payload: DeleteMappingPayload): Promise<MappingResponse> => {
    const headers = await getAuthHeaders();
    const response = await fetch(endpoints.donationManagerMappings, {
      method: 'DELETE',
      headers,
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    const data: MappingResponse = text
      ? JSON.parse(text)
      : { success: false, message: 'Empty response', data: null };

    if (!response.ok) {
      throw new Error(data.message || 'Failed to delete mapping');
    }

    return data;
  },

  getDonationManagersBySubcategory: async (
    subcategoryId: string,
    params?: {
      page?: number;
      limit?: number;
    },
  ): Promise<DonationManagersBySubcategoryResponse> => {
    const headers = await getAuthHeaders();
    const query = buildQueryString(params);
    const response = await fetch(
      `${endpoints.donationManagersBySubcategory(subcategoryId)}${query}`,
      {
        method: 'GET',
        headers,
      },
    );

    const text = await response.text();
    const data: DonationManagersBySubcategoryResponse = text
      ? JSON.parse(text)
      : { success: false, message: 'Empty response', data: null };

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch donation managers for subcategory');
    }

    return data;
  },
};

