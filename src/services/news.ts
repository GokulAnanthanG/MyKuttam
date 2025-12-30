import { endpoints } from '../config/api';

export type MediaType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO';

export type NewsUser = {
  _id: string;
  name: string;
  phone: string;
  role: string[]; // Changed to array to support multiple roles
  avatar?: string;
};

export type News = {
  id: string;
  title: string;
  description?: string;
  media_type: MediaType;
  media_src?: string;
  external_url?: string;
  is_highlighted: boolean;
  created_by: NewsUser;
  modified_by?: NewsUser | null;
  created_date: string;
  modified_date?: string | null;
  noOfComments: number;
  noOfLikes: number;
};

export type NewsResponse = {
  success: boolean;
  message: string;
  data: {
    news?: News[];
    pagination?: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  } & Partial<News>;
};

export type CommentUser = {
  id: string;
  name: string;
  phone: string;
  avatar?: string;
};

export type Comment = {
  id: string;
  news_id: string;
  user_id: CommentUser;
  comment: string;
  createdAt: string;
  updatedAt: string;
};

export type CommentResponse = {
  success: boolean;
  message: string;
  data: {
    comments?: Comment[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  } & Partial<Comment>;
};

export type LikeUser = {
  id: string;
  name: string;
  phone: string;
  avatar?: string;
};

export type Like = {
  id: string;
  news_id: string;
  user_id: LikeUser;
  createdAt: string;
};

export type LikeResponse = {
  success: boolean;
  message: string;
  data: {
    id?: string;
    news_id?: string;
    user_id?: LikeUser;
    createdAt?: string;
    isLiked?: boolean;
    like?: Like | null;
    likes?: Like[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
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
  // For form data, don't set Content-Type - React Native will set it with boundary
  
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  
  return headers;
};

export const NewsService = {
  // Get all news with filters
  getAllNews: async (
    params?: {
      media_type?: MediaType;
      is_highlighted?: boolean | string;
      created_by?: string;
      limit?: number;
      page?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    },
  ): Promise<NewsResponse> => {
    const headers = await getAuthHeaders();
    const queryParams = new URLSearchParams();
    
    if (params?.media_type) queryParams.append('media_type', params.media_type);
    if (params?.is_highlighted !== undefined) {
      queryParams.append('is_highlighted', String(params.is_highlighted));
    }
    if (params?.created_by) queryParams.append('created_by', params.created_by);
    if (params?.limit) queryParams.append('limit', String(params.limit));
    if (params?.page) queryParams.append('page', String(params.page));
    if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);
    
    const url = `${endpoints.news}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    const text = await response.text();
    const data: NewsResponse = text ? JSON.parse(text) : { success: false, message: 'Empty response', data: {} };

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch news');
    }

    return data;
  },

  // Get news list (non-highlighted)
  getNewsList: async (
    params?: {
      limit?: number;
      page?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    },
  ): Promise<NewsResponse> => {
    const headers = await getAuthHeaders();
    const queryParams = new URLSearchParams();
    
    if (params?.limit) queryParams.append('limit', String(params.limit));
    if (params?.page) queryParams.append('page', String(params.page));
    if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);
    
    const url = `${endpoints.newsList}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    const text = await response.text();
    
    let data: NewsResponse;
    try {
      data = text ? JSON.parse(text) : { success: false, message: 'Empty response', data: {} };
    } catch (parseError) {
      throw new Error(`Invalid response format from server (Status: ${response.status})`);
    }

    if (!response.ok) {
      const errorMsg = data.message || `Failed to fetch news list (Status: ${response.status})`;
      throw new Error(errorMsg);
    }

    return data;
  },

  // Get highlighted news
  getHighlightedNews: async (
    params?: {
      limit?: number;
      page?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    },
  ): Promise<NewsResponse> => {
    const headers = await getAuthHeaders();
    const queryParams = new URLSearchParams();
    
    if (params?.limit) queryParams.append('limit', String(params.limit));
    if (params?.page) queryParams.append('page', String(params.page));
    if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);
    
    const url = `${endpoints.newsHighlighted}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });
    
    const text = await response.text();
    
    let data: NewsResponse;
    try {
      data = text ? JSON.parse(text) : { success: false, message: 'Empty response', data: {} };
    } catch (parseError) {
      throw new Error(`Invalid response format from server (Status: ${response.status})`);
    }

    if (!response.ok) {
      const errorMsg = data.message || `Failed to fetch highlighted news (Status: ${response.status})`;
      throw new Error(errorMsg);
    }

    return data;
  },

  // Get news by ID
  getNewsById: async (id: string): Promise<NewsResponse> => {
    const headers = await getAuthHeaders();
    const response = await fetch(endpoints.newsById(id), {
      method: 'GET',
      headers,
    });

    const text = await response.text();
    const data: NewsResponse = text ? JSON.parse(text) : { success: false, message: 'Empty response', data: {} };

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch news');
    }

    return data;
  },

  // Create news
  createNews: async (payload: {
    title: string;
    media_type: MediaType;
    description?: string;
    is_highlighted?: boolean | string;
    link?: string;
    external_url?: string;
    media?: { uri: string; type: string; name: string };
  }): Promise<NewsResponse> => {
    const headers = await getAuthHeaders('form');
    
    const formData = new FormData();
    formData.append('title', payload.title);
    formData.append('media_type', payload.media_type);
    
    if (payload.description) {
      formData.append('description', payload.description);
    }
    if (payload.is_highlighted !== undefined) {
      formData.append('is_highlighted', String(payload.is_highlighted));
    }
    if (payload.link) {
      formData.append('link', payload.link);
    }
    if (payload.external_url) {
      formData.append('external_url', payload.external_url);
    }
    if (payload.media) {
      formData.append('media', payload.media as any);
    }

    const response = await fetch(endpoints.news, {
      method: 'POST',
      headers,
      body: formData,
    });

    const text = await response.text();
    const data: NewsResponse = text ? JSON.parse(text) : { success: false, message: 'Empty response', data: {} };

    if (!response.ok) {
      throw new Error(data.message || 'Failed to create news');
    }

    return data;
  },

  // Update news
  updateNews: async (
    id: string,
    updates: {
      title?: string;
      description?: string;
      media_type?: MediaType;
      media_src?: string;
      external_url?: string;
      is_highlighted?: boolean;
      modified_by?: string;
    },
  ): Promise<NewsResponse> => {
    const headers = await getAuthHeaders();
    const response = await fetch(endpoints.newsById(id), {
      method: 'PUT',
      headers,
      body: JSON.stringify({ data: updates }),
    });

    const text = await response.text();
    const data: NewsResponse = text ? JSON.parse(text) : { success: false, message: 'Empty response', data: {} };

    if (!response.ok) {
      throw new Error(data.message || 'Failed to update news');
    }

    return data;
  },

  // Delete news
  deleteNews: async (id: string): Promise<{ success: boolean; message: string }> => {
    const headers = await getAuthHeaders();
    const response = await fetch(endpoints.newsById(id), {
      method: 'DELETE',
      headers,
    });

    const text = await response.text();
    const data = text
      ? (JSON.parse(text) as { success: boolean; message: string })
      : ({ success: false, message: 'Empty response' } as { success: boolean; message: string });

    if (!response.ok) {
      throw new Error(data.message || 'Failed to delete news');
    }

    return data;
  },

  // Add comment
  addComment: async (newsId: string, comment: string): Promise<CommentResponse> => {
    const headers = await getAuthHeaders();
    const response = await fetch(endpoints.comments, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        news_id: newsId,
        comment: comment.trim(),
      }),
    });

    const text = await response.text();
    const data: CommentResponse = text ? JSON.parse(text) : { success: false, message: 'Empty response', data: {} };

    if (!response.ok) {
      throw new Error(data.message || 'Failed to add comment');
    }

    return data;
  },

  // Get comments by news ID
  getCommentsByNews: async (
    newsId: string,
    params?: {
      page?: number;
      limit?: number;
    },
  ): Promise<CommentResponse> => {
    const headers = await getAuthHeaders();
    const queryParams = new URLSearchParams();
    
    if (params?.page) queryParams.append('page', String(params.page));
    if (params?.limit) queryParams.append('limit', String(params.limit));
    
    const url = `${endpoints.commentsByNews(newsId)}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    const text = await response.text();
    const data: CommentResponse = text ? JSON.parse(text) : { success: false, message: 'Empty response', data: {} };

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch comments');
    }

    return data;
  },

  // Edit comment
  editComment: async (id: string, comment: string): Promise<CommentResponse> => {
    const headers = await getAuthHeaders();
    const response = await fetch(endpoints.commentById(id), {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        comment: comment.trim(),
      }),
    });

    const text = await response.text();
    const data: CommentResponse = text ? JSON.parse(text) : { success: false, message: 'Empty response', data: {} };

    if (!response.ok) {
      throw new Error(data.message || 'Failed to update comment');
    }

    return data;
  },

  // Delete comment
  deleteComment: async (id: string): Promise<{ success: boolean; message: string }> => {
    const headers = await getAuthHeaders();
    const response = await fetch(endpoints.commentById(id), {
      method: 'DELETE',
      headers,
    });

    const text = await response.text();
    const data = text
      ? (JSON.parse(text) as { success: boolean; message: string })
      : ({ success: false, message: 'Empty response' } as { success: boolean; message: string });

    if (!response.ok) {
      throw new Error(data.message || 'Failed to delete comment');
    }

    return data;
  },

  // Like Management APIs
  // Toggle like (add or remove)
  toggleLike: async (newsId: string): Promise<LikeResponse> => {
    const headers = await getAuthHeaders();
    const response = await fetch(endpoints.likes, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ news_id: newsId }),
    });

    const text = await response.text();
    const data: LikeResponse = text ? JSON.parse(text) : { success: false, message: 'Empty response', data: null };

    if (!response.ok) {
      throw new Error(data.message || 'Failed to toggle like');
    }

    return data;
  },

  // Add like
  addLike: async (newsId: string): Promise<LikeResponse> => {
    const headers = await getAuthHeaders();
    const response = await fetch(endpoints.likes, {
      method: 'POST',
      headers,
      body: JSON.stringify({ news_id: newsId }),
    });

    const text = await response.text();
    const data: LikeResponse = text ? JSON.parse(text) : { success: false, message: 'Empty response', data: null };

    if (!response.ok) {
      throw new Error(data.message || 'Failed to add like');
    }

    return data;
  },

  // Remove like
  removeLike: async (newsId: string): Promise<{ success: boolean; message: string }> => {
    const headers = await getAuthHeaders();
    const response = await fetch(endpoints.likes, {
      method: 'DELETE',
      headers,
      body: JSON.stringify({ news_id: newsId }),
    });

    const text = await response.text();
    const data = text
      ? (JSON.parse(text) as { success: boolean; message: string })
      : ({ success: false, message: 'Empty response' } as { success: boolean; message: string });

    if (!response.ok) {
      throw new Error(data.message || 'Failed to remove like');
    }

    return data;
  },

  // Get like status
  getLikeStatus: async (newsId: string): Promise<LikeResponse> => {
    const headers = await getAuthHeaders();
    const response = await fetch(`${endpoints.likeStatus}?news_id=${newsId}`, {
      method: 'GET',
      headers,
    });

    const text = await response.text();
    const data: LikeResponse = text ? JSON.parse(text) : { success: false, message: 'Empty response', data: null };

    if (!response.ok) {
      throw new Error(data.message || 'Failed to get like status');
    }

    return data;
  },

  // Get likes by news ID
  getLikesByNews: async (
    newsId: string,
    params?: { page?: number; limit?: number },
  ): Promise<LikeResponse> => {
    const headers = await getAuthHeaders();
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', String(params.page));
    if (params?.limit) queryParams.append('limit', String(params.limit));

    const url = `${endpoints.likesByNews(newsId)}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    const text = await response.text();
    const data: LikeResponse = text ? JSON.parse(text) : { success: false, message: 'Empty response', data: null };

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch likes');
    }

    return data;
  },
};

