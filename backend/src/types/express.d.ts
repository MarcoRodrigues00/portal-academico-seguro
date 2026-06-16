import 'express';

declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      sub: string;
      email?: string;
      name?: string;
      preferred_username?: string;
      roles: string[];
    };
  }
}
