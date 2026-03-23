import { endpoints } from '../config/api';

export type EventItem = {
  id?: string;
  _id?: string;
  title: string;
  description?: string;
  image?: string;
  event_date: string;
  createdAt?: string;
  updatedAt?: string;
};

type EventsListResponse = {
  success: boolean;
  message: string;
  data: {
    events?: EventItem[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  } | EventItem[];
};

type EventResponse = {
  success: boolean;
  message: string;
  data: EventItem | null;
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

export const EventService = {
  getEvents: async (params?: {
    page?: number;
    limit?: number;
    filter?: 'all' | 'upcoming';
  }): Promise<EventsListResponse> => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', String(params.page));
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.filter) query.append('filter', params.filter);

    const response = await fetch(
      `${endpoints.events}${query.toString() ? `?${query.toString()}` : ''}`,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } },
    );
    return parseResponse<EventsListResponse>(response);
  },

  getEventById: async (id: string): Promise<EventResponse> => {
    const response = await fetch(endpoints.eventById(id), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    return parseResponse<EventResponse>(response);
  },

  createEvent: async (payload: {
    title: string;
    event_date: string;
    description?: string;
    image?: { uri: string; type: string; name: string } | null;
  }): Promise<EventResponse> => {
    const headers = await getAuthHeaders('form');
    const formData = new FormData();
    formData.append('title', payload.title.trim());
    formData.append('event_date', payload.event_date.trim());
    if (payload.description && payload.description.trim()) {
      formData.append('description', payload.description.trim());
    }
    if (payload.image) {
      formData.append('image', payload.image as any);
    }

    const response = await fetch(endpoints.events, {
      method: 'POST',
      headers,
      body: formData,
    });
    return parseResponse<EventResponse>(response);
  },

  updateEvent: async (
    id: string,
    updates: {
      title?: string;
      event_date?: string;
      description?: string;
      image?: { uri: string; type: string; name: string } | null;
    },
  ): Promise<EventResponse> => {
    const headers = await getAuthHeaders('form');
    const formData = new FormData();

    if (updates.title !== undefined) formData.append('title', updates.title.trim());
    if (updates.event_date !== undefined) formData.append('event_date', updates.event_date.trim());
    if (updates.description !== undefined) formData.append('description', updates.description.trim());
    if (updates.image) formData.append('image', updates.image as any);

    const response = await fetch(endpoints.eventById(id), {
      method: 'PUT',
      headers,
      body: formData,
    });
    return parseResponse<EventResponse>(response);
  },

  deleteEvent: async (id: string): Promise<{ success: boolean; message: string; data: null }> => {
    const headers = await getAuthHeaders();
    const response = await fetch(endpoints.eventById(id), {
      method: 'DELETE',
      headers,
    });
    return parseResponse<{ success: boolean; message: string; data: null }>(response);
  },
};
