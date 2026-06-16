import { NextFunction, Request, Response, RequestHandler } from 'express';
import jwt, { JwtHeader, SigningKeyCallback } from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
import { env } from '../config/env.js';
import logger from '../lib/logger.js';
import { AuthenticatedUser } from '../types/auth.js';

interface KeycloakTokenPayload {
  sub: string;
  email?: string;
  name?: string;
  preferred_username?: string;
  realm_access?: { roles: string[] };
  iss?: string;
  aud?: string | string[];
}

const jwksClient = jwksRsa({
  jwksUri: env.KEYCLOAK_JWKS_URI,
  cache: true,
  cacheMaxAge: 10 * 60 * 1000,
  rateLimit: true,
  jwksRequestsPerMinute: 5,
});

function getKey(header: JwtHeader, callback: SigningKeyCallback): void {
  jwksClient.getSigningKey(header.kid, (err, key) => {
    if (err || !key) {
      callback(err ?? new Error('Chave de assinatura não encontrada'));
      return;
    }
    callback(null, key.getPublicKey());
  });
}

const ISSUER = env.KEYCLOAK_ISSUER;

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    logger.warn('Auth: header ausente', { ip: req.ip, path: req.path });
    res.status(401).json({ error: 'Não autorizado' });
    return;
  }

  if (!authHeader.startsWith('Bearer ')) {
    logger.warn('Auth: formato de token inválido', { ip: req.ip, path: req.path });
    res.status(401).json({ error: 'Não autorizado' });
    return;
  }

  const token = authHeader.slice(7);

  jwt.verify(
    token,
    getKey,
    {
      issuer: ISSUER,
      // Validação de audience não ativada: o Keycloak não inclui o client_id
      // no campo `aud` por padrão. Para ativar, configure "Audience" mapper
      // no cliente Keycloak e adicione: audience: env.KEYCLOAK_CLIENT_ID
      algorithms: ['RS256'],
    },
    (err, decoded) => {
      if (err) {
        logger.warn('Auth: token JWT rejeitado', { reason: err.message, ip: req.ip, path: req.path });
        res.status(401).json({ error: 'Não autorizado' });
        return;
      }

      const payload = decoded as KeycloakTokenPayload;

      if (!payload.sub) {
        logger.warn('Auth: token sem campo sub', { ip: req.ip, path: req.path });
        res.status(401).json({ error: 'Não autorizado' });
        return;
      }

      const user: AuthenticatedUser = {
        sub: payload.sub,
        email: payload.email,
        name: payload.name,
        preferred_username: payload.preferred_username,
        roles: payload.realm_access?.roles ?? [],
      };

      req.user = user;
      next();
    },
  );
}

// Verifica se o usuário autenticado possui ao menos um dos roles informados.
// Deve ser usado sempre após requireAuth na chain de middlewares.
export function requireRole(...roles: string[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Não autorizado' });
      return;
    }
    const hasRole = roles.some(role => req.user!.roles.includes(role));
    if (!hasRole) {
      res.status(403).json({ error: 'Acesso negado' });
      return;
    }
    next();
  };
}
