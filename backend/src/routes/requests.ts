import { NextFunction, Request, Response, Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { resolveUserFields } from '../lib/userService.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

// Limite específico para criação de requerimentos: 10 por 15 minutos por IP
const createLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente em 15 minutos.' },
});

const createRequestSchema = z.object({
  title: z.string().trim().min(1, 'title é obrigatório').max(100, 'title deve ter no máximo 100 caracteres'),
  description: z.string().trim().min(1, 'description é obrigatório').max(2000, 'description deve ter no máximo 2000 caracteres'),
});

async function getLocalUser(req: Request) {
  const { sub, email, name } = resolveUserFields(req.user!);
  return prisma.user.upsert({
    where: { keycloakId: sub },
    update: {},
    create: { keycloakId: sub, email, name },
    select: { id: true },
  });
}

router.post('/', createLimiter, requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const parsed = createRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }

  try {
    const localUser = await getLocalUser(req);

    const request = await prisma.request.create({
      data: {
        userId: localUser.id,
        title: parsed.data.title,
        description: parsed.data.description,
      },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        createdAt: true,
      },
    });

    res.status(201).json({ request });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const localUser = await getLocalUser(req);

    const requests = await prisma.request.findMany({
      where: { userId: localUser.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        createdAt: true,
      },
    });

    res.status(200).json({ requests });
  } catch (err) {
    next(err);
  }
});

export default router;
