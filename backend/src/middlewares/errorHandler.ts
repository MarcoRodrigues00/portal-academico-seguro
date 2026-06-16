import { Prisma } from '@prisma/client';
import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/AppError.js';
import logger from '../lib/logger.js';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({ error: err.flatten().fieldErrors });
    return;
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({ error: 'Parâmetro inválido' });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'Conflito: registro já existe' });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Registro não encontrado' });
      return;
    }
  }

  const message = err instanceof Error ? err.message : 'Erro desconhecido';
  logger.error(message, { stack: err instanceof Error ? err.stack : undefined });
  res.status(500).json({ error: 'Internal server error' });
}
