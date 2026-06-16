import { AuthenticatedUser } from '../types/auth.js';

/**
 * Resolve os campos de nome e email a partir do payload Keycloak.
 * Keycloak pode omitir campos dependendo do mapeamento de claims configurado.
 */
export function resolveUserFields(user: AuthenticatedUser): {
  sub: string;
  email: string;
  name: string;
} {
  const email = user.email?.trim() ?? '';
  const name =
    user.name?.trim() || user.preferred_username?.trim() || email || 'Usuário';
  return { sub: user.sub, email, name };
}
