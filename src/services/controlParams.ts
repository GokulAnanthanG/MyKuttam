import { endpoints } from '../config/api';

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

export type ControlParams = {
  id: string | null;
  IsEnableOnlinePayment: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

type GetControlParamsResponse = {
  success: boolean;
  message: string;
  data: ControlParams;
};

type UpdateControlParamsResponse = {
  success: boolean;
  message: string;
  data: ControlParams;
};

type UpdateControlParamsPayload = {
  IsEnableOnlinePayment?: boolean;
};

export const ControlParamsService = {
  getControlParams: async (): Promise<GetControlParamsResponse> => {
    const headers = await getAuthHeaders();
    const response = await fetch(endpoints.controlParams, {
      method: 'GET',
      headers,
    });

    const text = await response.text();
    const data: GetControlParamsResponse = text
      ? JSON.parse(text)
      : { success: false, message: 'Empty response', data: { id: null, IsEnableOnlinePayment: false, createdAt: null, updatedAt: null } };

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch control params');
    }

    return data;
  },

  updateControlParams: async (
    updates: UpdateControlParamsPayload
  ): Promise<UpdateControlParamsResponse> => {
    const headers = await getAuthHeaders();
    const response = await fetch(endpoints.controlParams, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updates),
    });

    const text = await response.text();
    const data: UpdateControlParamsResponse = text
      ? JSON.parse(text)
      : { success: false, message: 'Empty response', data: { id: null, IsEnableOnlinePayment: false, createdAt: null, updatedAt: null } };

    if (!response.ok) {
      throw new Error(data.message || 'Failed to update control params');
    }

    return data;
  },
};
