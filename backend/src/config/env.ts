import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().url(),
  TRUST_PROXY: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  DATABASE_URL: z.string().url(),
  KEYCLOAK_URL: z.string().url(),
  KEYCLOAK_REALM: z.string().min(1),
  KEYCLOAK_CLIENT_ID: z.string().min(1),
  // Overrides opcionais para separar issuer (claim `iss` do token) da URI de
  // busca de chave pública (JWKS). Necessário quando o backend roda em container
  // e o Keycloak só é alcançável via host.docker.internal, mas os tokens carregam
  // `iss` com localhost (URL visível ao navegador).
  KEYCLOAK_ISSUER: z.string().url().optional(),
  KEYCLOAK_JWKS_URI: z.string().url().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const base = parsed.data;

export const env = {
  ...base,
  KEYCLOAK_ISSUER:
    base.KEYCLOAK_ISSUER ??
    `${base.KEYCLOAK_URL}/realms/${base.KEYCLOAK_REALM}`,
  KEYCLOAK_JWKS_URI:
    base.KEYCLOAK_JWKS_URI ??
    `${base.KEYCLOAK_URL}/realms/${base.KEYCLOAK_REALM}/protocol/openid-connect/certs`,
};
