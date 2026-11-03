import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export type Role = "STUDENT" | "TEACHER" | "ADMIN";

const ROLES: Role[] = ["STUDENT", "TEACHER", "ADMIN"];

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: Role;
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
    // Tokens antigos (sem role) são tratados como aluno.
    req.userRole = ROLES.includes(decoded.role) ? decoded.role : "STUDENT";

    console.log("[AUTH] Usuário autenticado:", req.userId, req.userRole);

    return next();
  } catch {
    return res.status(401).json({
      error: "Token inválido ou expirado.",
    });
  }
};

// Use depois do authMiddleware: libera a rota só para os perfis informados.
export const requireRole =
  (...allowed: Role[]) =>
  (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userRole || !allowed.includes(req.userRole)) {
      return res.status(403).json({
        error: "Você não tem permissão para acessar este recurso.",
      });
    }

    return next();
  };
