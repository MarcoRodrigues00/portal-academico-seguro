import { Router } from 'express';
import authRouter from './auth.js';
import coursesRouter from './courses.js';
import requestsRouter from './requests.js';
import subjectsRouter from './subjects.js';

const router = Router();

router.use('/api/courses', coursesRouter);
router.use('/api/subjects', subjectsRouter);
router.use('/api/auth', authRouter);
router.use('/api/requests', requestsRouter);

export default router;
