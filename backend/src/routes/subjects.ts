import { SubjectContentType } from '@prisma/client';
import { NextFunction, Request, Response, Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { AppError } from '../lib/AppError.js';
import prisma from '../lib/prisma.js';
import { resolveUserFields } from '../lib/userService.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(v: string): boolean { return UUID_RE.test(v); }

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente em 15 minutos.' },
});

// ── Helpers ────────────────────────────────────────────────────────────────

async function getLocalUser(req: Request) {
  const { sub, email, name } = resolveUserFields(req.user!);
  return prisma.user.upsert({
    where: { keycloakId: sub },
    update: {},
    create: { keycloakId: sub, email, name },
    select: { id: true },
  });
}

// Retorna a disciplina se o usuário tem acesso de leitura:
// admin, professor da disciplina, ou aluno matriculado.
async function getSubjectOrFail(subjectId: string, userId: string, roles: string[]) {
  if (!isValidUUID(subjectId)) throw new AppError(404, 'Disciplina não encontrada');
  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    select: {
      id: true,
      professorUserId: true,
      code: true,
      name: true,
      credits: true,
      schedule: true,
      room: true,
      professorName: true,
      semester: { select: { name: true, isActive: true } },
    },
  });

  if (!subject) throw new AppError(404, 'Disciplina não encontrada');

  const isAdmin = roles.includes('admin');
  const isOwnProfessor = subject.professorUserId === userId;

  if (isAdmin || isOwnProfessor) return subject;

  const enrollment = await prisma.subjectEnrollment.findUnique({
    where: { userId_subjectId: { userId, subjectId } },
    select: { id: true },
  });

  if (!enrollment) throw new AppError(403, 'Acesso negado a esta disciplina');

  return subject;
}

// Retorna a disciplina somente para admin ou o professor responsável.
// Usado nas rotas de escrita (POST).
async function getSubjectAsProfessor(subjectId: string, userId: string, roles: string[]) {
  if (!isValidUUID(subjectId)) throw new AppError(404, 'Disciplina não encontrada');
  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    select: { id: true, professorUserId: true },
  });

  if (!subject) throw new AppError(404, 'Disciplina não encontrada');

  const isAdmin = roles.includes('admin');
  if (!isAdmin && subject.professorUserId !== userId) {
    throw new AppError(403, 'Você não é o professor desta disciplina');
  }

  return subject;
}

// ── GET /api/subjects/me ───────────────────────────────────────────────────
// IMPORTANTE: deve ficar antes de /:id para não ser capturado como parâmetro

router.get('/me', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const localUser = await getLocalUser(req);
    const isProfessor =
      req.user!.roles.includes('professor') || req.user!.roles.includes('admin');

    const subjectSelect = {
      id: true,
      code: true,
      name: true,
      professorName: true,
      credits: true,
      schedule: true,
      room: true,
      semester: { select: { name: true, isActive: true } },
    };

    let subjects;

    if (isProfessor) {
      // Professor vê as disciplinas que ministra
      subjects = await prisma.subject.findMany({
        where: { professorUserId: localUser.id },
        orderBy: [{ semester: { name: 'desc' } }, { code: 'asc' }],
        select: subjectSelect,
      });
    } else {
      // Aluno vê as disciplinas em que está matriculado
      const enrollments = await prisma.subjectEnrollment.findMany({
        where: { userId: localUser.id },
        select: { subject: { select: subjectSelect } },
        orderBy: [{ subject: { semester: { name: 'desc' } } }, { subject: { code: 'asc' } }],
      });
      subjects = enrollments.map(e => e.subject);
    }

    res.status(200).json({ subjects });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/subjects/:id/grades ───────────────────────────────────────────

router.get('/:id/grades', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const localUser = await getLocalUser(req);
    await getSubjectOrFail(req.params.id, localUser.id, req.user!.roles);

    const grades = await prisma.grade.findMany({
      where: { userId: localUser.id, subjectId: req.params.id },
      orderBy: { assessmentName: 'asc' },
      select: {
        id: true,
        assessmentName: true,
        score: true,
        maxScore: true,
        recordedAt: true,
      },
    });

    res.status(200).json({ grades });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/subjects/:id/attendance ──────────────────────────────────────

router.get('/:id/attendance', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const localUser = await getLocalUser(req);
    await getSubjectOrFail(req.params.id, localUser.id, req.user!.roles);

    // Busca todas as aulas da disciplina com a presença do usuário (se registrada)
    const lessons = await prisma.lesson.findMany({
      where: { subjectId: req.params.id },
      orderBy: { date: 'asc' },
      select: {
        id: true,
        title: true,
        date: true,
        attendances: {
          where: { userId: localUser.id },
          select: { present: true },
          take: 1,
        },
      },
    });

    const result = lessons.map(l => ({
      id: l.id,
      title: l.title,
      date: l.date,
      present: l.attendances[0]?.present ?? null, // null = ainda não registrado
    }));

    const attended = result.filter(l => l.present === true).length;
    const total = result.length;

    res.status(200).json({
      summary: { attended, total },
      lessons: result,
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/subjects/:id/contents ────────────────────────────────────────

router.get('/:id/contents', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const localUser = await getLocalUser(req);
    await getSubjectOrFail(req.params.id, localUser.id, req.user!.roles);

    const contents = await prisma.subjectContent.findMany({
      where: { subjectId: req.params.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        type: true,
        filePath: true,
        url: true,
        createdAt: true,
        postedBy: { select: { name: true } },
      },
    });

    res.status(200).json({ contents });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/subjects/:id/grades ──────────────────────────────────────────

const gradeSchema = z
  .object({
    userId: z.string().uuid('userId inválido'),
    assessmentName: z.string().trim().min(1, 'assessmentName é obrigatório').max(50, 'assessmentName deve ter no máximo 50 caracteres'),
    score: z.number().min(0, 'score deve ser >= 0'),
    maxScore: z.number().min(0.1, 'maxScore deve ser > 0').default(10.0),
  })
  .refine((d) => d.score <= d.maxScore, {
    message: 'score não pode ser maior que maxScore',
    path: ['score'],
  });

router.post(
  '/:id/grades',
  writeLimiter,
  requireAuth,
  requireRole('professor', 'admin'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const parsed = gradeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      return;
    }

    try {
      const localUser = await getLocalUser(req);
      await getSubjectAsProfessor(req.params.id, localUser.id, req.user!.roles);

      const { userId, assessmentName, score, maxScore } = parsed.data;

      // Verifica que o aluno está matriculado nesta disciplina
      const studentEnrollment = await prisma.subjectEnrollment.findUnique({
        where: { userId_subjectId: { userId, subjectId: req.params.id } },
        select: { id: true },
      });
      if (!studentEnrollment) throw new AppError(404, 'Aluno não encontrado ou não matriculado nesta disciplina');

      // Upsert: professor pode corrigir nota sem duplicar
      const grade = await prisma.grade.upsert({
        where: {
          userId_subjectId_assessmentName: {
            userId,
            subjectId: req.params.id,
            assessmentName,
          },
        },
        update: { score, maxScore },
        create: { userId, subjectId: req.params.id, assessmentName, score, maxScore },
        select: {
          id: true,
          userId: true,
          assessmentName: true,
          score: true,
          maxScore: true,
          recordedAt: true,
        },
      });

      res.status(200).json({ grade });
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /api/subjects/:id/attendance ──────────────────────────────────────

const attendanceSchema = z.object({
  lessonId: z.string().uuid('lessonId inválido'),
  userId: z.string().uuid('userId inválido'),
  present: z.boolean(),
  notes: z.string().trim().max(500, 'notes deve ter no máximo 500 caracteres').optional(),
});

router.post(
  '/:id/attendance',
  writeLimiter,
  requireAuth,
  requireRole('professor', 'admin'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const parsed = attendanceSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      return;
    }

    try {
      const localUser = await getLocalUser(req);
      await getSubjectAsProfessor(req.params.id, localUser.id, req.user!.roles);

      const { lessonId, userId, present, notes } = parsed.data;

      // Verifica que a aula pertence à disciplina
      const lesson = await prisma.lesson.findFirst({
        where: { id: lessonId, subjectId: req.params.id },
        select: { id: true },
      });
      if (!lesson) throw new AppError(404, 'Aula não encontrada nesta disciplina');

      // Verifica que o aluno está matriculado nesta disciplina
      const studentEnrollment = await prisma.subjectEnrollment.findUnique({
        where: { userId_subjectId: { userId, subjectId: req.params.id } },
        select: { id: true },
      });
      if (!studentEnrollment) throw new AppError(404, 'Aluno não encontrado ou não matriculado nesta disciplina');

      // Upsert: professor pode corrigir presença sem duplicar
      const attendance = await prisma.attendance.upsert({
        where: { lessonId_userId: { lessonId, userId } },
        update: { present, notes },
        create: { lessonId, userId, present, notes },
        select: {
          id: true,
          lessonId: true,
          userId: true,
          present: true,
          notes: true,
          recordedAt: true,
        },
      });

      res.status(200).json({ attendance });
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /api/subjects/:id/contents ───────────────────────────────────────

const contentSchema = z.object({
  title: z.string().trim().min(1, 'title é obrigatório').max(200, 'title deve ter no máximo 200 caracteres'),
  type: z.nativeEnum(SubjectContentType),
  filePath: z.string().trim().max(500, 'filePath deve ter no máximo 500 caracteres').optional(),
  url: z.string().url('url inválida').optional(),
});

router.post(
  '/:id/contents',
  writeLimiter,
  requireAuth,
  requireRole('professor', 'admin'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const parsed = contentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      return;
    }

    try {
      const localUser = await getLocalUser(req);
      await getSubjectAsProfessor(req.params.id, localUser.id, req.user!.roles);

      const { title, type, filePath, url } = parsed.data;

      const content = await prisma.subjectContent.create({
        data: {
          subjectId: req.params.id,
          title,
          type,
          filePath,
          url,
          postedByUserId: localUser.id,
        },
        select: {
          id: true,
          title: true,
          type: true,
          filePath: true,
          url: true,
          createdAt: true,
        },
      });

      res.status(201).json({ content });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
