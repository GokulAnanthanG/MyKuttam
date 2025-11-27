import { endpoints } from '../config/api';

export type DonationSubcategory = {
  id: string;
  title: string;
  description?: string;
  type: string;
  amount?: number;
  totalIncome: number;
  totalExpense: number;
  netAmount: number;
};

export type DonationCategorySummary = {
  id: string;
  name: string;
  overallIncome: number;
  overallExpense: number;
  netAmount: number;
  subcategories?: DonationSubcategory[];
  managers?: {
    id: string;
    name: string;
    phone?: string;
  }[];
  createdAt?: string;
  updatedAt?: string;
};

export type DonationSummaryResponse = {
  success: boolean;
  message: string;
  data: DonationCategorySummary[];
};

export type DonationRecord = {
  id: string;
  subcategory: {
    id: string;
    title: string;
    type: string;
    amount?: number;
  };
  amount: number;
  payment_method: 'online' | 'offline' | 'online offline';
  payment_status: 'pending' | 'success' | 'failed';
  transaction_id?: string;
  donor?: {
    id?: string;
    name?: string;
    phone?: string;
    address?: string;
  };
  manager?: {
    id?: string;
    name?: string;
    role?: string;
  };
  createdAt: string;
};

export type DonationListResponse = {
  success: boolean;
  message: string;
  data: {
    donations: DonationRecord[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  } | null;
};

export type DonationDetailResponse = {
  success: boolean;
  message: string;
  data: DonationRecord | null;
};

export type CategoryResponse = {
  success: boolean;
  message: string;
  data: DonationCategorySummary | null;
};

export type SubcategoryResponse = {
  success: boolean;
  message: string;
  data: DonationSubcategory | null;
};

export type CreateCategoryPayload = {
  name: string;
};

export type CreateSubcategoryPayload = {
  category_id: string;
  title: string;
  description?: string;
  type: 'open_donation' | 'specific_amount';
  amount?: number;
};

export type CreateDonationPayload = {
  subcategory_id: string;
  amount: number;
  payment_method: 'online' | 'offline' | 'online offline';
  transaction_id?: string;
  payment_status?: 'pending' | 'success' | 'failed';
  donor_id?: string;
  Donor_name?: string;
  donor_father_name?: string;
  donor_address?: string;
  donor_phone?: string;
  manager_id?: string;
};

export type UpdateDonationPayload = Partial<Pick<CreateDonationPayload, 'payment_method' | 'payment_status' | 'transaction_id'>> & {
  amount?: number;
};

export type UserDonationRecord = {
  id: string;
  amount: number;
  payment_status: 'pending' | 'success' | 'failed';
  payment_method: 'online' | 'offline' | 'online offline';
  transaction_id?: string;
  createdAt: string;
  subcategory: {
    id: string;
    title: string;
    type: string;
    amount?: number;
    category: {
      id: string;
      name: string;
    };
  };
  donor: {
    id: string;
    name: string;
    phone: string;
    avatar?: string;
    father_name?: string;
    address?: string;
  };
  manager?: {
    id: string;
    name: string;
    role?: string;
  } | null;
};

export type UserDonationSummary = {
  totalDonations: number;
  totalAmount: number;
  successAmount: number;
  pendingAmount: number;
  failedAmount: number;
  successCount: number;
  pendingCount: number;
  failedCount: number;
};

export type UserDonationsByCategoryResponse = {
  success: boolean;
  message: string;
  data: {
    category: {
      id: string;
      name: string;
    };
    donations: UserDonationRecord[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    summary: UserDonationSummary;
  } | null;
};

export type UserDonationsOverallResponse = {
  success: boolean;
  message: string;
  data: {
    donations: UserDonationRecord[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    summary: UserDonationSummary;
  } | null;
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

export const DonationService = {
  getCategoriesSummary: async (): Promise<DonationSummaryResponse> => {
    const headers = await getAuthHeaders();
    const response = await fetch(endpoints.donationCategoriesSummary, {
      method: 'GET',
      headers,
    });

    const text = await response.text();
    const data: DonationSummaryResponse = text
      ? JSON.parse(text)
      : { success: false, message: 'Empty response', data: [] };

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch donation summary');
    }

    return data;
  },

  createCategory: async (payload: CreateCategoryPayload): Promise<CategoryResponse> => {
    const headers = await getAuthHeaders();
    const response = await fetch(endpoints.categories, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    const data: CategoryResponse = text ? JSON.parse(text) : { success: false, message: 'Empty response', data: null };

    if (!response.ok) {
      throw new Error(data.message || 'Failed to create category');
    }

    return data;
  },

  createSubcategory: async (payload: CreateSubcategoryPayload): Promise<SubcategoryResponse> => {
    const headers = await getAuthHeaders();
    const response = await fetch(endpoints.subcategories, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    const data: SubcategoryResponse = text
      ? JSON.parse(text)
      : { success: false, message: 'Empty response', data: null };

    if (!response.ok) {
      throw new Error(data.message || 'Failed to create subcategory');
    }

    return data;
  },

  createDonation: async (payload: CreateDonationPayload): Promise<DonationDetailResponse> => {
    const headers = await getAuthHeaders();
    const response = await fetch(endpoints.donations, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    const data: DonationDetailResponse = text
      ? JSON.parse(text)
      : { success: false, message: 'Empty response', data: null };

    if (!response.ok) {
      throw new Error(data.message || 'Failed to create donation');
    }

    return data;
  },

  getDonations: async (params?: {
    subcategory_id?: string;
    donor_id?: string;
    payment_method?: 'online' | 'offline' | 'online offline';
    payment_status?: 'pending' | 'success' | 'failed';
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<DonationListResponse> => {
    const headers = await getAuthHeaders();
    const query = buildQueryString(params);
    const response = await fetch(`${endpoints.donations}${query}`, {
      method: 'GET',
      headers,
    });
    console.log("api",`${endpoints.donations}${query}`)
    const text = await response.text();
    const data: DonationListResponse = text
      ? JSON.parse(text)
      : { success: false, message: 'Empty response', data: null };

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch donations');
    }

    return data;
  },

  getDonationById: async (id: string): Promise<DonationDetailResponse> => {
    const headers = await getAuthHeaders();
    const response = await fetch(endpoints.donationById(id), {
      method: 'GET',
      headers,
    });

    const text = await response.text();
    const data: DonationDetailResponse = text
      ? JSON.parse(text)
      : { success: false, message: 'Empty response', data: null };

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch donation');
    }

    return data;
  },

  updateDonation: async (id: string, payload: UpdateDonationPayload): Promise<DonationDetailResponse> => {
    const headers = await getAuthHeaders();
    const response = await fetch(endpoints.donationById(id), {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    const data: DonationDetailResponse = text
      ? JSON.parse(text)
      : { success: false, message: 'Empty response', data: null };

    if (!response.ok) {
      throw new Error(data.message || 'Failed to update donation');
    }

    return data;
  },

  deleteDonation: async (id: string): Promise<DonationDetailResponse> => {
    const headers = await getAuthHeaders();
    const response = await fetch(endpoints.donationById(id), {
      method: 'DELETE',
      headers,
    });

    const text = await response.text();
    const data: DonationDetailResponse = text
      ? JSON.parse(text)
      : { success: false, message: 'Empty response', data: null };

    if (!response.ok) {
      throw new Error(data.message || 'Failed to delete donation');
    }

    return data;
  },

  getUserDonationsByCategory: async (
    userIdOrPhone: string,
    categoryId: string,
    params?: {
      page?: number;
      limit?: number;
      startDate?: string;
      endDate?: string;
      payment_status?: 'pending' | 'success' | 'failed';
    },
  ): Promise<UserDonationsByCategoryResponse> => {
    const headers = await getAuthHeaders();
    const query = buildQueryString(params);
    const response = await fetch(`${endpoints.userDonationsByCategory(userIdOrPhone, categoryId)}${query}`, {
      method: 'GET',
      headers,
    });

    const text = await response.text();
    const data: UserDonationsByCategoryResponse = text
      ? JSON.parse(text)
      : { success: false, message: 'Empty response', data: null };

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch user donations by category');
    }

    return data;
  },

  getUserDonationsOverall: async (
    userIdOrPhone: string,
    params?: {
      page?: number;
      limit?: number;
      startDate?: string;
      endDate?: string;
      payment_status?: 'pending' | 'success' | 'failed';
    },
  ): Promise<UserDonationsOverallResponse> => {
    const headers = await getAuthHeaders();
    const query = buildQueryString(params);
    const response = await fetch(`${endpoints.userDonationsOverall(userIdOrPhone)}${query}`, {
      method: 'GET',
      headers,
    });

    const text = await response.text();
    const data: UserDonationsOverallResponse = text
      ? JSON.parse(text)
      : { success: false, message: 'Empty response', data: null };

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch user donations overall');
    }

    return data;
  },
};

