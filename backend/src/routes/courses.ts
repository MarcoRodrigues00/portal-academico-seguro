import { BadgeType } from '@prisma/client';
import { NextFunction, Request, Response, Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { AppError } from '../lib/AppError.js';
import prisma from '../lib/prisma.js';
import { resolveUserFields } from '../lib/userService.js';
import { requireAuth } from '../middlewares/auth.js';

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

// Upsert local user from Keycloak token (mesmo padrão de requests.ts)
async function getLocalUser(req: Request) {
  const { sub, email, name } = resolveUserFields(req.user!);
  return prisma.user.upsert({
    where: { keycloakId: sub },
    update: {},
    create: { keycloakId: sub, email, name },
    select: { id: true },
  });
}

// Emite um badge apenas se o usuário ainda não o possui (sem unique no schema).
async function awardBadgeIfNew(userId: string, type: BadgeType, courseId: string | null = null) {
  const exists = await prisma.userBadge.findFirst({
    where: { userId, type, courseId },
    select: { id: true },
  });
  if (!exists) {
    await prisma.userBadge.create({
      data: { userId, type, ...(courseId ? { courseId } : {}) },
    });
  }
}

// Verifica se o curso foi concluído e, se sim, emite certificado e badges.
// Chamado tanto em /progress quanto em /questions/:qId/answer.
// Retorna true se o curso foi finalizado nesta chamada.
async function checkAndFinalizeCourse(
  courseId: string,
  userId: string,
  enrollmentId: string,
): Promise<boolean> {
  // Se já estava concluído, nada a fazer
  const enrollment = await prisma.courseEnrollment.findUnique({
    where: { id: enrollmentId },
    select: { completedAt: true, enrolledAt: true },
  });
  if (!enrollment || enrollment.completedAt) return false;

  // Condição 1: todos os módulos concluídos
  const [totalModules, completedModules] = await Promise.all([
    prisma.courseModule.count({ where: { courseId } }),
    prisma.courseProgress.count({ where: { enrollmentId } }),
  ]);
  if (totalModules === 0 || completedModules < totalModules) return false;

  // Condição 2: todas as questões respondidas corretamente (ou não há questões)
  const [totalQuestions, correctAnswers] = await Promise.all([
    prisma.courseQuestion.count({ where: { courseId } }),
    prisma.questionAnswer.count({
      where: { userId, isCorrect: true, question: { courseId } },
    }),
  ]);
  if (totalQuestions > 0 && correctAnswers < totalQuestions) return false;

  // ── Curso concluído ──

  const now = new Date();

  // Marca enrollment como concluído
  await prisma.courseEnrollment.update({
    where: { id: enrollmentId },
    data: { completedAt: now },
  });

  // Emite certificado (idempotente via upsert aproveitando @@unique)
  await prisma.certificate.upsert({
    where: { userId_courseId: { userId, courseId } },
    update: {},
    create: { userId, courseId },
  });

  // Badge: COURSE_COMPLETED
  await awardBadgeIfNew(userId, BadgeType.COURSE_COMPLETED, courseId);

  // Badge: PERFECT_SCORE (somente se havia questões e todas corretas)
  if (totalQuestions > 0 && correctAnswers >= totalQuestions) {
    await awardBadgeIfNew(userId, BadgeType.PERFECT_SCORE, courseId);
  }

  // Badge: FAST_LEARNER (concluiu em até 7 dias da matrícula)
  const daysSinceEnrollment =
    (now.getTime() - enrollment.enrolledAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceEnrollment <= 7) {
    await awardBadgeIfNew(userId, BadgeType.FAST_LEARNER, courseId);
  }

  return true;
}

// ── GET /api/courses/public ────────────────────────────────────────────────

router.get('/public', async (_req, res, next) => {
  try {
    const courses = await prisma.course.findMany({
      where: { isPublic: true },
      select: {
        id: true,
        title: true,
        description: true,
        level: true,
        estimatedHours: true,
        instructorName: true,
        thumbnail: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    res.status(200).json({ courses });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/courses/enrolled/me ───────────────────────────────────────────
// IMPORTANTE: deve ficar antes de /:id para não ser capturado como id

router.get('/enrolled/me', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const localUser = await getLocalUser(req);

    const enrollments = await prisma.courseEnrollment.findMany({
      where: { userId: localUser.id },
      orderBy: { enrolledAt: 'desc' },
      select: {
        id: true,
        enrolledAt: true,
        completedAt: true,
        course: {
          select: {
            id: true,
            title: true,
            description: true,
            level: true,
            estimatedHours: true,
            instructorName: true,
            thumbnail: true,
          },
        },
        progress: {
          select: { moduleId: true },
        },
      },
    });

    res.status(200).json({ enrollments });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/courses/:id ───────────────────────────────────────────────────

router.get('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (!isValidUUID(req.params.id)) { res.status(404).json({ error: 'Curso não encontrado' }); return; }
  try {
    const course = await prisma.course.findFirst({
      where: { id: req.params.id, isPublic: true },
      select: {
        id: true,
        title: true,
        description: true,
        isPublic: true,
        level: true,
        estimatedHours: true,
        instructorName: true,
        thumbnail: true,
        createdAt: true,
        _count: {
          select: {
            modules: true,
            enrollments: true,
          },
        },
      },
    });

    if (!course) throw new AppError(404, 'Curso não encontrado');

    res.status(200).json({ course });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/courses/:id/questions ────────────────────────────────────────

router.get('/:id/questions', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (!isValidUUID(req.params.id)) { res.status(404).json({ error: 'Curso não encontrado' }); return; }
  try {
    const course = await prisma.course.findFirst({
      where: { id: req.params.id, isPublic: true },
      select: { id: true },
    });

    if (!course) throw new AppError(404, 'Curso não encontrado');

    const questions = await prisma.courseQuestion.findMany({
      where: { courseId: course.id },
      orderBy: { order: 'asc' },
      select: { id: true, text: true, options: true, order: true },
    });

    res.status(200).json({ questions });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/courses/:id/modules ───────────────────────────────────────────

router.get('/:id/modules', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (!isValidUUID(req.params.id)) { res.status(404).json({ error: 'Curso não encontrado' }); return; }
  try {
    const course = await prisma.course.findFirst({
      where: { id: req.params.id, isPublic: true },
      select: { id: true },
    });

    if (!course) throw new AppError(404, 'Curso não encontrado');

    const modules = await prisma.courseModule.findMany({
      where: { courseId: course.id },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        title: true,
        description: true,
        order: true,
        durationMin: true,
        videoUrl: true,
      },
    });

    res.status(200).json({ modules });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/courses/:id/qa ────────────────────────────────────────────────

router.get('/:id/qa', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (!isValidUUID(req.params.id)) { res.status(404).json({ error: 'Curso não encontrado' }); return; }
  try {
    const course = await prisma.course.findFirst({
      where: { id: req.params.id, isPublic: true },
      select: { id: true },
    });

    if (!course) throw new AppError(404, 'Curso não encontrado');

    const posts = await prisma.courseDiscussionPost.findMany({
      where: { courseId: course.id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        question: true,
        authorName: true,
        answer: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.status(200).json({ posts });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/courses/:id/qa ───────────────────────────────────────────────

const qaSchema = z.object({
  question: z.string().trim().min(1, 'question é obrigatório').max(500, 'question deve ter no máximo 500 caracteres'),
});

router.post('/:id/qa', writeLimiter, requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (!isValidUUID(req.params.id)) { res.status(404).json({ error: 'Curso não encontrado' }); return; }
  const parsed = qaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }

  try {
    const course = await prisma.course.findFirst({
      where: { id: req.params.id, isPublic: true },
      select: { id: true },
    });

    if (!course) throw new AppError(404, 'Curso não encontrado');

    const localUser = await getLocalUser(req);
    const { name } = resolveUserFields(req.user!);

    const post = await prisma.courseDiscussionPost.create({
      data: {
        courseId: course.id,
        question: parsed.data.question,
        authorName: name,
        authorUserId: localUser.id,
      },
      select: {
        id: true,
        question: true,
        authorName: true,
        answer: true,
        createdAt: true,
      },
    });

    res.status(201).json({ post });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/courses/:id/enroll ───────────────────────────────────────────

router.post('/:id/enroll', writeLimiter, requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (!isValidUUID(req.params.id)) { res.status(404).json({ error: 'Curso não encontrado' }); return; }
  try {
    const course = await prisma.course.findFirst({
      where: { id: req.params.id, isPublic: true },
      select: { id: true },
    });

    if (!course) throw new AppError(404, 'Curso não encontrado');

    const localUser = await getLocalUser(req);

    // P2002 do errorHandler cobre o caso de matrícula duplicada → 409
    const enrollment = await prisma.courseEnrollment.create({
      data: {
        userId: localUser.id,
        courseId: course.id,
      },
      select: {
        id: true,
        courseId: true,
        enrolledAt: true,
      },
    });

    // Badge FIRST_ENROLLMENT: apenas na primeira matrícula do usuário
    const totalEnrollments = await prisma.courseEnrollment.count({
      where: { userId: localUser.id },
    });
    if (totalEnrollments === 1) {
      await awardBadgeIfNew(localUser.id, BadgeType.FIRST_ENROLLMENT);
    }

    res.status(201).json({ enrollment });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/courses/:id/progress ─────────────────────────────────────────

const progressSchema = z.object({
  moduleId: z.string().uuid('moduleId inválido'),
});

router.post('/:id/progress', writeLimiter, requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (!isValidUUID(req.params.id)) { res.status(404).json({ error: 'Curso não encontrado' }); return; }
  const parsed = progressSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }

  try {
    const course = await prisma.course.findFirst({
      where: { id: req.params.id, isPublic: true },
      select: { id: true },
    });

    if (!course) throw new AppError(404, 'Curso não encontrado');

    const localUser = await getLocalUser(req);

    const enrollment = await prisma.courseEnrollment.findUnique({
      where: { userId_courseId: { userId: localUser.id, courseId: course.id } },
      select: { id: true },
    });

    if (!enrollment) throw new AppError(403, 'Você não está matriculado neste curso');

    const module = await prisma.courseModule.findFirst({
      where: { id: parsed.data.moduleId, courseId: course.id },
      select: { id: true },
    });

    if (!module) throw new AppError(404, 'Módulo não encontrado neste curso');

    // Idempotente: upsert garante que marcar duas vezes não duplica
    const progress = await prisma.courseProgress.upsert({
      where: {
        enrollmentId_moduleId: {
          enrollmentId: enrollment.id,
          moduleId: module.id,
        },
      },
      update: {},
      create: {
        enrollmentId: enrollment.id,
        moduleId: module.id,
      },
      select: {
        enrollmentId: true,
        moduleId: true,
        completedAt: true,
      },
    });

    const courseFinalized = await checkAndFinalizeCourse(course.id, localUser.id, enrollment.id);

    res.status(200).json({ progress, courseFinalized });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/courses/:id/questions/:qId/answer ────────────────────────────

const answerSchema = z.object({
  selectedOption: z.number().int().min(0, 'selectedOption inválido'),
});

router.post('/:id/questions/:qId/answer', writeLimiter, requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (!isValidUUID(req.params.id) || !isValidUUID(req.params.qId)) {
    res.status(404).json({ error: 'Recurso não encontrado' });
    return;
  }
  const parsed = answerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }

  try {
    const course = await prisma.course.findFirst({
      where: { id: req.params.id, isPublic: true },
      select: { id: true },
    });

    if (!course) throw new AppError(404, 'Curso não encontrado');

    const localUser = await getLocalUser(req);

    const enrollment = await prisma.courseEnrollment.findUnique({
      where: { userId_courseId: { userId: localUser.id, courseId: course.id } },
      select: { id: true },
    });

    if (!enrollment) throw new AppError(403, 'Você não está matriculado neste curso');

    const question = await prisma.courseQuestion.findFirst({
      where: { id: req.params.qId, courseId: course.id },
      select: { id: true, correctAnswer: true, explanation: true },
    });

    if (!question) throw new AppError(404, 'Questão não encontrada neste curso');

    // Impede reenvio: uma resposta por questão por usuário
    const alreadyAnswered = await prisma.questionAnswer.findUnique({
      where: { userId_questionId: { userId: localUser.id, questionId: question.id } },
      select: { id: true },
    });

    if (alreadyAnswered) {
      throw new AppError(409, 'Você já respondeu esta questão');
    }

    const { selectedOption } = parsed.data;
    const isCorrect = selectedOption === question.correctAnswer;

    await prisma.questionAnswer.create({
      data: {
        userId: localUser.id,
        questionId: question.id,
        selectedOption,
        isCorrect,
      },
    });

    const courseFinalized = await checkAndFinalizeCourse(course.id, localUser.id, enrollment.id);

    res.status(201).json({
      answer: {
        selectedOption,
        isCorrect,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
      },
      courseFinalized,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
