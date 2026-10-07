import { Request } from 'express';


interface DecodedToken {
  id: number;
  email?: string;
  ativo?: boolean;
  perfil?: string;
  ciaIds?: number[]; // Adicionado pelo middleware ensureCiaAccess
}

declare global {
  namespace Express {
    interface Request {
      user?: DecodedToken;
    }
  }
}