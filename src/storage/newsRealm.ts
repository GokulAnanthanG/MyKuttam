/**
 * Realm Storage for News Images (Offline Support)
 * 
 * Stores the first 5 news items with images for offline viewing
 */
import Realm from 'realm';
import type { News } from '../services/news';

interface RealmNews extends News {
  _id: Realm.BSON.UUID;
  storedAt: Date;
}

const NewsSchema: Realm.ObjectSchema = {
  name: 'RealmNews',
  primaryKey: 'id',
  properties: {
    _id: 'uuid',
    id: 'string',
    title: 'string',
    description: 'string?',
    media_type: 'string',
    media_src: 'string?',
    external_url: 'string?',
    is_highlighted: 'bool',
    created_by: 'string', // Store as JSON string
    modified_by: 'string?', // Store as JSON string
    created_date: 'string',
    modified_date: 'string?',
    noOfComments: 'int',
    noOfLikes: 'int',
    storedAt: 'date',
  },
};

let realmInstance: Realm | null = null;

const getRealm = async () => {
  if (realmInstance) {
    return realmInstance;
  }

  realmInstance = await Realm.open({
    path: 'mykuttam-news',
    schema: [NewsSchema],
    schemaVersion: 1,
  });

  return realmInstance;
};

/**
 * Save news items with images to Realm (only first 5 with images)
 */
export const saveNewsImagesToRealm = async (newsItems: News[]) => {
  try {
    const realm = await getRealm();
    const now = new Date();

    // Filter news items that have images
    const newsWithImages = newsItems.filter(
      (news) => news.media_type === 'IMAGE' && news.media_src
    );

    // Only store first 5 news items with images
    const newsToStore = newsWithImages.slice(0, 5);

    if (newsToStore.length === 0) {
      return; // No images to store
    }

    realm.write(() => {
      // Delete all existing news first
      const allNews = realm.objects<RealmNews>('RealmNews');
      realm.delete(allNews);

      // Store new news items
      newsToStore.forEach((news) => {
        const realmNews: RealmNews = {
          _id: new Realm.BSON.UUID(),
          id: news.id,
          title: news.title,
          description: news.description || '',
          media_type: news.media_type,
          media_src: news.media_src || '',
          external_url: news.external_url || '',
          is_highlighted: news.is_highlighted,
          created_by: JSON.stringify(news.created_by),
          modified_by: news.modified_by ? JSON.stringify(news.modified_by) : '',
          created_date: news.created_date,
          modified_date: news.modified_date || '',
          noOfComments: news.noOfComments || 0,
          noOfLikes: news.noOfLikes || 0,
          storedAt: now,
        };
        realm.create<RealmNews>('RealmNews', realmNews);
      });
    });
  } catch (error) {
    console.error('Error saving news images to Realm:', error);
  }
};

/**
 * Get stored news items with images from Realm
 */
export const getStoredNewsImages = async (): Promise<News[]> => {
  try {
    const realm = await getRealm();
    const newsItems = realm.objects<RealmNews>('RealmNews');

    return newsItems.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description || undefined,
      media_type: item.media_type as News['media_type'],
      media_src: item.media_src || undefined,
      external_url: item.external_url || undefined,
      is_highlighted: item.is_highlighted,
      created_by: JSON.parse(item.created_by),
      modified_by: item.modified_by ? JSON.parse(item.modified_by) : undefined,
      created_date: item.created_date,
      modified_date: item.modified_date || undefined,
      noOfComments: item.noOfComments || 0,
      noOfLikes: item.noOfLikes || 0,
    }));
  } catch (error) {
    console.error('Error getting stored news images from Realm:', error);
    return [];
  }
};

