import { NextFunction, Request, Response, Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import prisma from '../lib/prisma.js';
import { resolveUserFields } from '../lib/userService.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

// Sub-limite para /auth/me: chamado uma vez por sessão no frontend,
// mas sem limite próprio seria sujeito ao budget global de 100/15min
const meLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente em 15 minutos.' },
});

router.get('/me', meLimiter, requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { sub, email, name } = resolveUserFields(req.user!);

  try {
    // Garante que o usuário existe no banco local; não retornamos os dados
    // do localUser para evitar exposição de IDs internos e campos duplicados
    await prisma.user.upsert({
      where: { keycloakId: sub },
      update: {},
      create: { keycloakId: sub, email, name },
      select: { id: true },
    });

    res.status(200).json({ user: req.user });
  } catch (err) {
    next(err);
  }
});

export default router;
