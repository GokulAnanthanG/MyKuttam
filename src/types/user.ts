export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'BLOCK';
export type AccountType = 'COMMON' | 'MANAGEMENT';
export type UserRole =
  | 'ADMIN'
  | 'SUB_ADMIN'
  | 'HELPHER'
  | 'DONATION_MANAGER'
  | 'USER';

export type StoredUser = {
  id?: string;
  phone: string;
  name: string;
  password?: string; // Optional since we might not always have it
  account_type: AccountType;
  role: UserRole;
  dob?: string;
  avatar?: string;
  father_name?: string;
  address?: string;
  status?: AccountStatus;
  report_count?: number;
};

