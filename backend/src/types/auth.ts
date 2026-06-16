export interface AuthenticatedUser {
  sub: string;
  email?: string;
  name?: string;
  preferred_username?: string;
  roles: string[];
}
