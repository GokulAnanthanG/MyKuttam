/**
 * Realm Storage for Donation Category Pins (Offline Support)
 * 
 * This module stores pinned donation categories locally using Realm.
 * This enables offline functionality:
 * - Remember pinned categories when offline
 * - Persist pin preferences across app restarts
 * 
 * Stored Data:
 * - Category ID: to identify which category is pinned
 * - Timestamp: when the category was pinned
 */
import Realm from 'realm';

interface RealmPinnedCategory {
  _id: Realm.BSON.UUID;
  categoryId: string;
  pinnedAt: Date;
}

const PinnedCategorySchema: Realm.ObjectSchema = {
  name: 'RealmPinnedCategory',
  primaryKey: 'categoryId',
  properties: {
    _id: 'uuid',
    categoryId: 'string',
    pinnedAt: 'date',
  },
};

let realmInstance: Realm | null = null;

const getRealm = async () => {
  if (realmInstance) {
    return realmInstance;
  }

  realmInstance = await Realm.open({
    path: 'mykuttam-donations',
    schema: [PinnedCategorySchema],
    schemaVersion: 1,
  });

  return realmInstance;
};

/**
 * Pin a category
 */
export const pinCategory = async (categoryId: string): Promise<void> => {
  const realm = await getRealm();
  realm.write(() => {
    // Check if already pinned
    const existing = realm.objectForPrimaryKey<RealmPinnedCategory>(
      'RealmPinnedCategory',
      categoryId,
    );

    if (!existing) {
      const pinnedCategory: RealmPinnedCategory = {
        _id: new Realm.BSON.UUID(),
        categoryId,
        pinnedAt: new Date(),
      };
      realm.create<RealmPinnedCategory>('RealmPinnedCategory', pinnedCategory);
    }
  });
};

/**
 * Unpin a category
 */
export const unpinCategory = async (categoryId: string): Promise<void> => {
  const realm = await getRealm();
  realm.write(() => {
    const pinned = realm.objectForPrimaryKey<RealmPinnedCategory>(
      'RealmPinnedCategory',
      categoryId,
    );
    if (pinned) {
      realm.delete(pinned);
    }
  });
};

/**
 * Get all pinned category IDs
 */
export const getPinnedCategoryIds = async (): Promise<Set<string>> => {
  const realm = await getRealm();
  const pinnedCategories = realm.objects<RealmPinnedCategory>('RealmPinnedCategory');
  const pinnedIds = new Set<string>();
  
  pinnedCategories.forEach((pinned) => {
    pinnedIds.add(pinned.categoryId);
  });
  
  return pinnedIds;
};

/**
 * Check if a category is pinned
 */
export const isCategoryPinned = async (categoryId: string): Promise<boolean> => {
  const realm = await getRealm();
  const pinned = realm.objectForPrimaryKey<RealmPinnedCategory>(
    'RealmPinnedCategory',
    categoryId,
  );
  return !!pinned;
};

/**
 * Clear all pinned categories
 */
export const clearAllPinnedCategories = async (): Promise<void> => {
  const realm = await getRealm();
  realm.write(() => {
    const all = realm.objects<RealmPinnedCategory>('RealmPinnedCategory');
    realm.delete(all);
  });
};

