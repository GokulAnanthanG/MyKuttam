export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'BLOCK';
export type AccountType = 'COMMON' | 'MANAGEMENT';
export type UserRole =
  | 'ADMIN'
  | 'SUB_ADMIN'
  | 'HELPER'
  | 'DONATION_MANAGER'
  | 'USER';

export type StoredUser = {
  id?: string;
  phone: string;
  name: string;
  password?: string; // Optional since we might not always have it
  account_type: AccountType;
  role: UserRole[]; // Changed from single role to array of roles
  dob?: string;
  avatar?: string;
  father_name?: string;
  address?: string;
  status?: AccountStatus;
  report_count?: number;
};

