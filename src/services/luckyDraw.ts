import { endpoints } from '../config/api';

export type LuckyDrawWinner = {
  user_id?: {
    name?: string;
    phone?: string;
  } | null;
  user?: {
    id?: string;
    name?: string;
    phone?: string;
    father_name?: string;
    address?: string;
  } | null;
  gift_id?: {
    product_name?: string;
    image?: string;
  } | null;
  gift?: {
    id?: string;
    product_name?: string;
    image?: string;
  } | null;
  lucky_number?: number;
  draw_date?: string;
};

export type LuckyDrawEvent = {
  id?: string;
  _id?: string;
  title: string;
  description?: string;
  thumnail?: string;
  createdAt?: string;
  updatedAt?: string;
  status?: boolean;
  created_by?: {
    name?: string;
    phone?: string;
    role?: string[];
    avatar?: string;
  };
  winners?: LuckyDrawWinner[];
  gifts?: Array<{
    _id?: string;
    id?: string;
    product_name?: string;
    available_quantity?: number;
    image?: string;
    description?: string;
  }>;
};

type LuckyDrawEventsResponse = {
  success: boolean;
  message: string;
  data: LuckyDrawEvent[];
};

type LuckyDrawEventResponse = {
  success: boolean;
  message: string;
  data: LuckyDrawEvent | null;
};

type LuckyDrawDrawResponse = {
  success: boolean;
  message: string;
  data?: {
    winner?: {
      user_id?: {
        name?: string;
        phone?: string;
      } | null;
      gift_id?: {
        product_name?: string;
        image?: string;
      } | null;
    } | null;
  } | null;
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

export const LuckyDrawService = {
  getEvents: async (): Promise<LuckyDrawEventsResponse> => {
    const headers = await getAuthHeaders();
    const response = await fetch(endpoints.luckyDrawEvents, {
      method: 'GET',
      headers,
    });

    const parsed = await parseResponse<{
      success: boolean;
      message: string;
      data: LuckyDrawEvent[] | { events?: LuckyDrawEvent[] } | null;
    }>(response);
    const normalizedEvents = Array.isArray(parsed.data)
      ? parsed.data
      : (parsed.data?.events ?? []);

    return {
      ...parsed,
      data: normalizedEvents,
    };
  },

  createEvent: async (
    title: string,
    description?: string,
    thumnail?: { uri: string; type: string; name: string } | null,
  ): Promise<LuckyDrawEventResponse> => {
    const headers = await getAuthHeaders('form');
    const formData = new FormData();

    formData.append('title', title.trim());
    if (description && description.trim()) {
      formData.append('description', description.trim());
    }
    if (thumnail) {
      formData.append('thumnail', thumnail as any);
    }

    const response = await fetch(endpoints.luckyDrawEvents, {
      method: 'POST',
      headers,
      body: formData,
    });

    return parseResponse<LuckyDrawEventResponse>(response);
  },

  updateEvent: async (
    id: string,
    updates: { title?: string; description?: string; status?: boolean | 'true' | 'false' },
  ): Promise<LuckyDrawEventResponse> => {
    const headers = await getAuthHeaders();
    const body: { title?: string; description?: string; status?: boolean } = {};

    if (updates.title !== undefined) {
      body.title = updates.title.trim();
    }
    if (updates.description !== undefined) {
      body.description = updates.description.trim();
    }
    if (updates.status !== undefined) {
      if (typeof updates.status === 'string') {
        if (updates.status === 'true') {
          body.status = true;
        } else if (updates.status === 'false') {
          body.status = false;
        } else {
          throw new Error('Status must be a boolean value (true or false)');
        }
      } else {
        body.status = updates.status;
      }
    }

    if (Object.keys(body).length === 0) {
      throw new Error('At least one field (title, description, or status) is required');
    }

    const response = await fetch(endpoints.luckyDrawEventById(id), {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });

    return parseResponse<LuckyDrawEventResponse>(response);
  },

  deleteEvent: async (id: string): Promise<{ success: boolean; message: string; data: null }> => {
    const headers = await getAuthHeaders();
    const response = await fetch(endpoints.luckyDrawEventById(id), {
      method: 'DELETE',
      headers,
    });

    return parseResponse<{ success: boolean; message: string; data: null }>(response);
  },

  drawLuckyWinner: async (): Promise<LuckyDrawDrawResponse> => {
    const headers = await getAuthHeaders();
    const response = await fetch(endpoints.luckyDrawAdminDraw, {
      method: 'GET',
      headers,
    });
    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();

    if (!response.ok) {
      if (contentType.includes('application/json') && text) {
        const json = JSON.parse(text) as { message?: string };
        throw new Error(json.message || 'Failed to open admin draw page');
      }
      throw new Error(text || 'Failed to open admin draw page');
    }

    // This endpoint can return HTML (SSR page) or JSON.
    if (contentType.includes('application/json') && text) {
      return JSON.parse(text) as LuckyDrawDrawResponse;
    }

    return {
      success: true,
      message: 'Lucky draw admin page loaded successfully',
      data: null,
    };
  },
};
