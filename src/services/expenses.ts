import { endpoints } from '../config/api';

export type ExpenseRecord = {
  id: string;
  subcategory: {
    id: string;
    title: string;
    type?: string;
    amount?: number;
  };
  expense_title: string;
  expense_description?: string;
  manager?: {
    id: string;
    name: string;
    role?: string;
  };
  amount: number;
  payment_method: 'cash' | 'online' | 'cheque';
  transaction_id?: string;
  status: 'approved' | 'pending' | 'rejected';
  createdAt: string;
};

export type ExpenseListResponse = {
  success: boolean;
  message: string;
  data: {
    expenses: ExpenseRecord[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  } | null;
};

export type ExpenseDetailResponse = {
  success: boolean;
  message: string;
  data: ExpenseRecord | null;
};

export type CreateExpensePayload = {
  subcategory_id: string;
  expense_title: string;
  expense_description?: string;
  manager_id?: string;
  amount: number;
  payment_method: 'cash' | 'online' | 'cheque';
  transaction_id?: string;
  status?: 'approved' | 'pending' | 'rejected';
};

export type UpdateExpensePayload = Partial<
  Pick<
    CreateExpensePayload,
    'expense_title' | 'expense_description' | 'amount' | 'payment_method' | 'transaction_id' | 'status'
  >
>;

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

export const ExpenseService = {
  createExpense: async (payload: CreateExpensePayload): Promise<ExpenseDetailResponse> => {
    const headers = await getAuthHeaders();
    const response = await fetch(endpoints.expenses, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    const data: ExpenseDetailResponse = text
      ? JSON.parse(text)
      : { success: false, message: 'Empty response', data: null };

    if (!response.ok) {
      throw new Error(data.message || 'Failed to create expense');
    }

    return data;
  },

  listExpenses: async (params?: {
    subcategory_id?: string;
    manager_id?: string;
    status?: 'approved' | 'pending' | 'rejected';
    payment_method?: 'cash' | 'online' | 'cheque';
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<ExpenseListResponse> => {
    const headers = await getAuthHeaders();
    const query = buildQueryString(params);
    console.log("expenses api", `${endpoints.expenses}${query}`);
    const response = await fetch(`${endpoints.expenses}${query}`, {
      method: 'GET',
      headers,
    });

    const text = await response.text();
    const data: ExpenseListResponse = text
      ? JSON.parse(text)
      : { success: false, message: 'Empty response', data: null };

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch expenses');
    }

    return data;
  },

  updateExpense: async (id: string, payload: UpdateExpensePayload): Promise<ExpenseDetailResponse> => {
    const headers = await getAuthHeaders();
    const response = await fetch(endpoints.expenseById(id), {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    const data: ExpenseDetailResponse = text
      ? JSON.parse(text)
      : { success: false, message: 'Empty response', data: null };

    if (!response.ok) {
      throw new Error(data.message || 'Failed to update expense');
    }

    return data;
  },

  deleteExpense: async (id: string): Promise<ExpenseDetailResponse> => {
    const headers = await getAuthHeaders();
    const response = await fetch(endpoints.expenseById(id), {
      method: 'DELETE',
      headers,
    });

    const text = await response.text();
    const data: ExpenseDetailResponse = text
      ? JSON.parse(text)
      : { success: false, message: 'Empty response', data: null };

    if (!response.ok) {
      throw new Error(data.message || 'Failed to delete expense');
    }

    return data;
  },
};


