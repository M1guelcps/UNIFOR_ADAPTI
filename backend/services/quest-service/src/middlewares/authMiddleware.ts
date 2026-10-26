import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  userId?: string;
}

interface TokenPayload {
  id: string;
  email?: string;
  name?: string;
}

export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Token não fornecido ou mal formatado.",
    });
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    return res.status(401).json({
      error: "Token não fornecido.",
    });
  }

  const secret = process.env.JWT_SECRET;

  if (!secret) {
    console.error("[AUTH] JWT_SECRET não configurado.");

    return res.status(500).json({
      error: "Erro na configuração de autenticação.",
    });
  }

  try {
    const decoded = jwt.verify(token, secret);

    if (
      typeof decoded === "string" ||
      typeof decoded.id !== "string" ||
      decoded.id.length === 0
    ) {
      return res.status(401).json({
        error: "Token inválido: ID do usuário ausente.",
      });
    }

    req.userId = decoded.id;

    console.log("[AUTH] Usuário autenticado:", req.userId);

    return next();
  } catch {
    return res.status(401).json({
      error: "Token inválido ou expirado.",
    });
  }
};