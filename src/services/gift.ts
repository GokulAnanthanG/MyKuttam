import { endpoints } from '../config/api';

export type Gift = {
  _id?: string;
  id?: string;
  lucky_draw_event_id: string;
  product_name: string;
  available_quantity?: number;
  image?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
};

type GiftResponse = {
  success: boolean;
  message: string;
  data: Gift | null;
};

const getAuthHeaders = async (
  contentType: 'json' | 'form' = 'json',
): Promise<Record<string, string>> => {
  const { getStoredToken } = await import('../storage/userRealm');
  const token = await getStoredToken();
  const headers: Record<string, string> = {};

  if (contentType === 'json') {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

const parseResponse = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  const data = text ? (JSON.parse(text) as T & { message?: string }) : ({} as T & { message?: string });

  if (!response.ok) {
    throw new Error(data.message || 'Request failed');
  }

  return data as T;
};

export const GiftService = {
  addGift: async (payload: {
    lucky_draw_event_id: string;
    product_name: string;
    image: { uri: string; type: string; name: string };
    available_quantity?: number;
    description?: string;
  }): Promise<GiftResponse> => {
    const headers = await getAuthHeaders('form');
    const formData = new FormData();

    formData.append('lucky_draw_event_id', payload.lucky_draw_event_id);
    formData.append('product_name', payload.product_name.trim());
    formData.append('image', payload.image as any);

    if (payload.available_quantity !== undefined && !Number.isNaN(payload.available_quantity)) {
      formData.append('available_quantity', String(payload.available_quantity));
    }

    if (payload.description && payload.description.trim()) {
      formData.append('description', payload.description.trim());
    }

    const response = await fetch(endpoints.gifts, {
      method: 'POST',
      headers,
      body: formData,
    });

    return parseResponse<GiftResponse>(response);
  },

  deleteGift: async (id: string): Promise<{ success: boolean; message: string; data: null }> => {
    const headers = await getAuthHeaders();
    const response = await fetch(endpoints.giftById(id), {
      method: 'DELETE',
      headers,
    });

    return parseResponse<{ success: boolean; message: string; data: null }>(response);
  },
};
