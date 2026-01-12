export type UserRole = "AGENT" | "SUPERVISOR" | "TECHNICIAN" | "MANAGER" | "ADMIN" | "SUPER_ADMIN";
export type UserStatus = "active" | "inactive" | "invited" | "blocked";

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  role: UserRole;
  status: UserStatus;
  is_online: boolean;
  last_seen: string | null;
  company_id: string;
  user_id: string; // auth.users id
  created_at: string;
  updated_at: string | null;
}

export interface CreateUserDTO {
  email: string;
  name: string;
  role?: UserRole;
  avatar?: string | null;
  company_id: string;
  user_id: string;
  status?: UserStatus;
}

export interface UpdateUserDTO extends Partial<Omit<CreateUserDTO, "user_id" | "company_id">> {
  is_online?: boolean;
  last_seen?: string | null;
}

export type Me = {
  id: string;
  name: string | null;
  companyName: string | null;
  companyId: string | null;
  avatarUrl?: string | null;
};
