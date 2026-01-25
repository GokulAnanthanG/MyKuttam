import { endpoints } from '../config/api';

export type Audio = {
  id: string;
  title: string;
  description: string;
  audio_url: string;
  uploaded_date: string;
  createdAt: string;
  updatedAt: string;
};

export type AudioResponse = {
  success: boolean;
  message: string;
  data: {
    audios: Audio[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
};

export type AudioUploadResponse = {
  success: boolean;
  message: string;
  data: Audio;
};

export type AudioUpdateResponse = {
  success: boolean;
  message: string;
  data: Audio;
};

const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const { getStoredToken } = await import('../storage/userRealm');
  const token = await getStoredToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const AudioService = {
  getAudios: async (page: number = 1, limit: number = 10): Promise<AudioResponse> => {
    const queryParams = new URLSearchParams();
    queryParams.append('page', String(page));
    queryParams.append('limit', String(limit));

    const response = await fetch(`${endpoints.audio}?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const text = await response.text();
    let data: AudioResponse;

    if (!text) {
      data = {
        success: false,
        message: 'Empty response',
        data: {
          audios: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        },
      };
    } else {
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        data = {
          success: false,
          message: 'Invalid JSON response',
          data: {
            audios: [],
            pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
          },
        };
      }
    }

    if (!response.ok) {
      throw new Error(data.message || `HTTP error! status: ${response.status}`);
    }

    return data;
  },

  uploadAudio: async (
    audioUri: string,
    title: string,
    description?: string,
  ): Promise<AudioUploadResponse> => {
    const { getStoredToken } = await import('../storage/userRealm');
    const token = await getStoredToken();

    if (!token) {
      throw new Error('Authentication required');
    }

    const formData = new FormData();
    formData.append('audio', {
      uri: audioUri,
      type: 'audio/mpeg',
      name: 'audio.mp3',
    } as any);
    formData.append('title', title.trim());

    if (description && description.trim()) {
      formData.append('description', description.trim());
    }

    const response = await fetch(endpoints.audioUpload, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
      body: formData,
    });

    const text = await response.text();
    let data: AudioUploadResponse;

    if (!text) {
      throw new Error('Empty response from server');
    }

    try {
      data = JSON.parse(text);
    } catch (parseError) {
      throw new Error('Invalid JSON response from server');
    }

    if (!response.ok) {
      throw new Error(data.message || `HTTP error! status: ${response.status}`);
    }

    return data;
  },

  updateAudio: async (
    id: string,
    title?: string,
    description?: string,
  ): Promise<AudioUpdateResponse> => {
    const headers = await getAuthHeaders();

    const body: { title?: string; description?: string } = {};
    if (title !== undefined) {
      body.title = title.trim();
    }
    if (description !== undefined) {
      body.description = description.trim();
    }

    if (Object.keys(body).length === 0) {
      throw new Error('At least one field (title or description) must be provided');
    }

    const response = await fetch(endpoints.audioById(id), {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });

    const text = await response.text();
    let data: AudioUpdateResponse;

    if (!text) {
      throw new Error('Empty response from server');
    }

    try {
      data = JSON.parse(text);
    } catch (parseError) {
      throw new Error('Invalid JSON response from server');
    }

    if (!response.ok) {
      throw new Error(data.message || `HTTP error! status: ${response.status}`);
    }

    return data;
  },

  deleteAudio: async (id: string): Promise<{ success: boolean; message: string }> => {
    const headers = await getAuthHeaders();

    const response = await fetch(endpoints.audioById(id), {
      method: 'DELETE',
      headers,
    });

    const text = await response.text();
    let data: { success: boolean; message: string };

    if (!text) {
      throw new Error('Empty response from server');
    }

    try {
      data = JSON.parse(text);
    } catch (parseError) {
      throw new Error('Invalid JSON response from server');
    }

    if (!response.ok) {
      throw new Error(data.message || `HTTP error! status: ${response.status}`);
    }

    return data;
  },
};


