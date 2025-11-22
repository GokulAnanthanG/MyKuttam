/**
 * Realm Storage for Gallery Images (Offline Support)
 * 
 * Stores the last 10 gallery images for offline viewing
 */
import Realm from 'realm';
import type { GalleryImage } from '../services/gallery';

interface RealmGalleryImage extends GalleryImage {
  _id: Realm.BSON.UUID;
  storedAt: Date;
}

const GalleryImageSchema: Realm.ObjectSchema = {
  name: 'RealmGalleryImage',
  primaryKey: 'id',
  properties: {
    _id: 'uuid',
    id: 'string',
    user_id: 'string', // Store as JSON string
    image_url: 'string',
    description: 'string',
    status: 'string',
    uploaded_date: 'string',
    createdAt: 'string',
    updatedAt: 'string',
    storedAt: 'date',
  },
};

let realmInstance: Realm | null = null;

const getRealm = async () => {
  if (realmInstance) {
    return realmInstance;
  }

  realmInstance = await Realm.open({
    path: 'mykuttam-gallery',
    schema: [GalleryImageSchema],
    schemaVersion: 1,
  });

  return realmInstance;
};

export const saveGalleryImagesToRealm = async (images: GalleryImage[]) => {
  const realm = await getRealm();
  const now = new Date();

  realm.write(() => {
    // Delete all existing images first (keep only last 10)
    const allImages = realm.objects<RealmGalleryImage>('RealmGalleryImage');
    realm.delete(allImages);

    // Store new images (limit to 10)
    const imagesToStore = images.slice(0, 10);
    imagesToStore.forEach((image) => {
      const realmImage: RealmGalleryImage = {
        _id: new Realm.BSON.UUID(),
        id: image.id,
        user_id: JSON.stringify(image.user_id),
        image_url: image.image_url,
        description: image.description,
        status: image.status,
        uploaded_date: image.uploaded_date,
        createdAt: image.createdAt,
        updatedAt: image.updatedAt,
        storedAt: now,
      };
      realm.create<RealmGalleryImage>('RealmGalleryImage', realmImage);
    });
  });
};

export const getStoredGalleryImages = async (): Promise<GalleryImage[]> => {
  const realm = await getRealm();
  const images = realm.objects<RealmGalleryImage>('RealmGalleryImage');

  return images.map((img) => ({
    id: img.id,
    user_id: JSON.parse(img.user_id),
    image_url: img.image_url,
    description: img.description,
    status: img.status as GalleryImage['status'],
    uploaded_date: img.uploaded_date,
    createdAt: img.createdAt,
    updatedAt: img.updatedAt,
  }));
};

