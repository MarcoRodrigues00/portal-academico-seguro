import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler } from './middlewares/errorHandler.js';
import router from './routes/index.js';

const app = express();

if (env.TRUST_PROXY) {
  app.set('trust proxy', 1);
}

// crossOriginResourcePolicy: 'cross-origin' é necessário para APIs chamadas
// por frontends em origens distintas (fetch com CORS)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);

// Restringir métodos e headers ao mínimo necessário pela API
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  }),
);

app.use(express.json({ limit: '10kb' }));

// Rejeitar requisições com corpo (POST/PUT/PATCH) sem Content-Type correto.
// Sem isso, express.json() silenciosamente ignora o body e o Zod retorna
// erros de validação que revelam os nomes dos campos esperados.
app.use((req: Request, res: Response, next: NextFunction): void => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const ct = req.headers['content-type'] ?? '';
    if (!ct.includes('application/json')) {
      res.status(415).json({ error: 'Content-Type deve ser application/json' });
      return;
    }
  }
  next();
});

// Health check antes do rate limit — ferramentas de monitoramento não consomem budget
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.use('/', router);

// 404 para rotas não registradas — antes do errorHandler
app.use((_req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

app.use(errorHandler);

export default app;
