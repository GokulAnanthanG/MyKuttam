import { endpoints } from '../config/api';

export type GalleryStatus = 'review' | 'approved'; // UI status
export type GalleryStatusAPI = 'review' | 'permitted'; // API status

export type GalleryImage = {
  id: string;
  user_id: {
    _id: string;
    name: string;
    phone: string;
  };
  image_url: string;
  description: string;
  category?: {
    id: string;
    name: string;
  } | null;
  status: 'review' | 'permitted'; // API returns 'review' or 'permitted' (permitted = approved)
  uploaded_date: string;
  createdAt: string;
  updatedAt: string;
};

export type GalleryResponse = {
  success: boolean;
  message: string;
  data: {
    images: GalleryImage[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
};

export type GalleryCategory = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type GalleryCategoriesResponse = {
  success: boolean;
  message: string;
  data: GalleryCategory[];
};

const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const { getStoredToken } = await import('../storage/userRealm');
  const token = await getStoredToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const GalleryService = {
  getGalleryImages: async (
    page: number = 1,
    limit: number = 10,
    status: GalleryStatus = 'approved',
    categoryId?: string | null,
  ): Promise<GalleryResponse> => {
    const headers = await getAuthHeaders();
    // Map 'approved' to 'permitted' for API
    const apiStatus = status === 'approved' ? 'permitted' : status;
    
    // Build query parameters
    const queryParams = new URLSearchParams();
    queryParams.append('page', String(page));
    queryParams.append('limit', String(limit));
    queryParams.append('status', apiStatus);
    
    // Add category filter only if provided (not null/undefined)
    if (categoryId) {
      queryParams.append('category', categoryId);
    }
    
    const response = await fetch(
      `${endpoints.gallery}?${queryParams.toString()}`,
      {
        method: 'GET',
        headers,
      },
    );

    const text = await response.text();
    let data: GalleryResponse;
    
    if (!text) {
      data = {
        success: false,
        message: 'Empty response',
        data: { images: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } },
      };
    } else {
      data = JSON.parse(text) as GalleryResponse;
    }

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch gallery images');
    }

    return data;
  },

  updateImageStatus: async (
    id: string,
    status: 'permitted',
  ): Promise<{ success: boolean; message: string }> => {
    const headers = await getAuthHeaders();
    const response = await fetch(endpoints.updateGalleryStatus(id), {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status }),
    });

    const text = await response.text();
    const data = text
      ? (JSON.parse(text) as { success: boolean; message: string })
      : ({} as { success: boolean; message: string });

    if (!response.ok) {
      throw new Error(data.message || 'Failed to update image status');
    }

    return data;
  },

  getGalleryImageById: async (id: string): Promise<{ success: boolean; message: string; data?: GalleryImage }> => {
    const headers = await getAuthHeaders();
    const response = await fetch(endpoints.deleteGalleryImage(id), {
      method: 'GET',
      headers,
    });

    const text = await response.text();
    const data = text
      ? (JSON.parse(text) as { success: boolean; message: string; data?: GalleryImage })
      : ({} as { success: boolean; message: string; data?: GalleryImage });

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch gallery image');
    }

    return data;
  },

  deleteImage: async (id: string): Promise<{ success: boolean; message: string }> => {
    const headers = await getAuthHeaders();
    const response = await fetch(endpoints.deleteGalleryImage(id), {
      method: 'DELETE',
      headers,
    });

    const text = await response.text();
    const data = text
      ? (JSON.parse(text) as { success: boolean; message: string })
      : ({} as { success: boolean; message: string });

    if (!response.ok) {
      throw new Error(data.message || 'Failed to delete image');
    }

    return data;
  },

  uploadImage: async (
    imageUri: string,
    categoryId: string,
    description?: string,
  ): Promise<{ success: boolean; message: string }> => {
    const { getStoredToken } = await import('../storage/userRealm');
    const token = await getStoredToken();

    const formData = new FormData();
    
    // Add image
    formData.append('image', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'image.jpg',
    } as any);

    // Add category (required)
    formData.append('category', categoryId);

    // Add description if provided
    if (description && description.trim()) {
      formData.append('description', description.trim());
    }

    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(endpoints.uploadGalleryImage, {
      method: 'POST',
      headers,
      body: formData,
    });

    const text = await response.text();
    const data = text
      ? (JSON.parse(text) as { success: boolean; message: string })
      : ({} as { success: boolean; message: string });

    if (!response.ok) {
      throw new Error(data.message || 'Failed to upload image');
    }

    return data;
  },

  getGalleryCategories: async (): Promise<GalleryCategoriesResponse> => {
    // Public endpoint, no auth required
    const response = await fetch(endpoints.galleryCategories, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const text = await response.text();
    let data: GalleryCategoriesResponse;
    
    if (!text) {
      data = {
        success: false,
        message: 'Empty response',
        data: [],
      };
    } else {
      data = JSON.parse(text) as GalleryCategoriesResponse;
    }

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch gallery categories');
    }

    return data;
  },

  createCategory: async (name: string): Promise<{ success: boolean; message: string; data?: GalleryCategory }> => {
    const headers = await getAuthHeaders();
    const response = await fetch(endpoints.galleryCategories, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: name.trim() }),
    });

    const text = await response.text();
    const data = text
      ? (JSON.parse(text) as { success: boolean; message: string; data?: GalleryCategory })
      : ({} as { success: boolean; message: string; data?: GalleryCategory });

    if (!response.ok) {
      throw new Error(data.message || 'Failed to create gallery category');
    }

    return data;
  },

  deleteCategory: async (id: string): Promise<{ success: boolean; message: string }> => {
    const headers = await getAuthHeaders();
    const response = await fetch(endpoints.galleryCategoryById(id), {
      method: 'DELETE',
      headers,
    });

    const text = await response.text();
    const data = text
      ? (JSON.parse(text) as { success: boolean; message: string })
      : ({} as { success: boolean; message: string });

    if (!response.ok) {
      throw new Error(data.message || 'Failed to delete gallery category');
    }

    return data;
  },

  updateImageCategory: async (
    imageId: string,
    categoryId: string | null,
  ): Promise<{ success: boolean; message: string; data?: GalleryImage }> => {
    const headers = await getAuthHeaders();
    const response = await fetch(endpoints.updateGalleryCategory(imageId), {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ category: categoryId }),
    });

    const text = await response.text();
    const data = text
      ? (JSON.parse(text) as { success: boolean; message: string; data?: GalleryImage })
      : ({} as { success: boolean; message: string; data?: GalleryImage });

    if (!response.ok) {
      throw new Error(data.message || 'Failed to update gallery image category');
    }

    return data;
  },
};

