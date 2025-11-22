/**
 * Realm Storage for User Data (Offline Support)
 * 
 * This module stores user authentication and profile data locally using Realm.
 * This enables offline functionality:
 * - Auto-login on app restart (no network required)
 * - View user profile when offline
 * - Access cached user data for authenticated features
 * 
 * Stored Data:
 * - User profile: name, phone, role, account_type, dob, avatar, father_name, address, status, report_count
 * - Authentication token: for API requests when online
 * - Timestamps: createdAt, updatedAt for data freshness tracking
 */
import Realm from 'realm';
import type { StoredUser } from '../types/user';

interface RealmUser extends StoredUser {
  _id: Realm.BSON.UUID;
  token?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Realm.ObjectSchema = {
  name: 'RealmUser',
  primaryKey: 'phone',
  properties: {
    _id: 'uuid',
    id: 'string?',
    phone: 'string',
    name: 'string',
    password: 'string?',
    account_type: 'string',
    role: 'string',
    dob: 'date?',
    avatar: 'string?',
    father_name: 'string?',
    address: 'string?',
    status: 'string?',
    report_count: 'int?',
    token: 'string?',
    createdAt: 'date',
    updatedAt: 'date',
  },
};

let realmInstance: Realm | null = null;

const getRealm = async () => {
  if (realmInstance) {
    return realmInstance;
  }

  realmInstance = await Realm.open({
    path: 'mykuttam-users',
    schema: [UserSchema],
    schemaVersion: 2, // Updated to include token field
  });

  return realmInstance;
};

export const saveUserToRealm = async (user: StoredUser, token?: string) => {
  const realm = await getRealm();
  const now = new Date();

  realm.write(() => {
    // Check if user already exists
    const existingUser = realm.objectForPrimaryKey<RealmUser>(
      'RealmUser',
      user.phone,
    );

    if (existingUser) {
      // Update existing user
      existingUser.id = user.id ?? existingUser.id;
      existingUser.name = user.name;
      existingUser.password = user.password ?? existingUser.password;
      existingUser.account_type = user.account_type;
      existingUser.role = user.role;
      existingUser.dob = user.dob ? new Date(user.dob) : existingUser.dob;
      existingUser.avatar = user.avatar ?? existingUser.avatar;
      existingUser.father_name = user.father_name ?? existingUser.father_name;
      existingUser.address = user.address ?? existingUser.address;
      existingUser.status = user.status ?? existingUser.status ?? 'ACTIVE';
      existingUser.report_count = user.report_count ?? existingUser.report_count ?? 0;
      existingUser.token = token ?? existingUser.token;
      existingUser.updatedAt = now;
    } else {
      // Create new user
      const newUser: RealmUser = {
        _id: new Realm.BSON.UUID(),
        id: user.id,
        phone: user.phone,
        name: user.name,
        password: user.password,
        account_type: user.account_type,
        role: user.role,
        dob: user.dob ? new Date(user.dob) : undefined,
        avatar: user.avatar,
        father_name: user.father_name,
        address: user.address,
        status: user.status ?? 'ACTIVE',
        report_count: user.report_count ?? 0,
        token: token,
        createdAt: now,
        updatedAt: now,
      };
      realm.create<RealmUser>('RealmUser', newUser);
    }
  });
};

export const clearStoredUser = async () => {
  const realm = await getRealm();
  realm.write(() => {
    const all = realm.objects<RealmUser>('RealmUser');
    realm.delete(all);
  });
};

export const getStoredUser = async (): Promise<{
  user: StoredUser | null;
  token: string | null;
}> => {
  const realm = await getRealm();
  const user = realm.objects<RealmUser>('RealmUser')[0];

  if (!user) {
    return { user: null, token: null };
  }

  return {
    user: {
      id: user.id ?? undefined,
      phone: user.phone,
      name: user.name,
      password: user.password ?? undefined,
      account_type: user.account_type as StoredUser['account_type'],
      role: user.role as StoredUser['role'],
      dob: user.dob?.toISOString(),
      avatar: user.avatar ?? undefined,
      father_name: user.father_name ?? undefined,
      address: user.address ?? undefined,
      status: user.status ?? undefined,
      report_count: user.report_count ?? undefined,
    },
    token: user.token ?? null,
  };
};

export const getStoredToken = async (): Promise<string | null> => {
  const realm = await getRealm();
  const user = realm.objects<RealmUser>('RealmUser')[0];
  return user?.token ?? null;
};

