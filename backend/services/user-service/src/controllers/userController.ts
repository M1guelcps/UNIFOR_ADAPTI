import { Request, Response } from "express";
import { UserService } from "../services/userService.js";
import { AuthRequest, Role } from "../middlewares/authMiddleware.js";

const ROLES: Role[] = ["STUDENT", "TEACHER", "ADMIN"];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class UserController {
  static async syncUser(req: Request, res: Response) {
    try {
      const { id, name, email, role } = req.body;

      if (!id || !name || !email) {
        return res.status(400).json({ error: "ID, nome e e-mail são obrigatórios para sincronizar." });
      }

      const user = await UserService.syncUser({ id, name, email, role });

      return res.status(201).json(user);
    } catch (error: any) {
      console.error("[USER SYNC ERROR]:", error);
      return res.status(500).json({ error: "Erro interno ao sincronizar usuário." });
    }
  }

  // Rota interna: o Auth Service usa no login para descobrir o perfil (role).
  static async getInternal(req: Request, res: Response) {
    try {
      const user = await UserService.getById(String(req.params.id));

      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado." });
      }

      return res.status(200).json(user);
    } catch (error: any) {
      console.error("[USER INTERNAL GET ERROR]:", error);
      return res.status(500).json({ error: "Erro ao buscar usuário." });
    }
  }

  static async me(req: AuthRequest, res: Response) {
    try {
      const user = await UserService.getById(req.userId!);

      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado." });
      }

      return res.status(200).json(user);
    } catch (error: any) {
      console.error("[USER ME ERROR]:", error);
      return res.status(500).json({ error: "Erro ao buscar usuário." });
    }
  }

  static async list(req: Request, res: Response) {
    try {
      const page = Math.max(parseInt(req.query.page as string) || 1, 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 10, 1), 100);
      const roleParam = typeof req.query.role === "string" ? req.query.role.toUpperCase() : undefined;
      const search = typeof req.query.search === "string" ? req.query.search.trim() : undefined;

      if (roleParam && !ROLES.includes(roleParam as Role)) {
        return res.status(400).json({ error: "role deve ser STUDENT, TEACHER ou ADMIN." });
      }

      const result = await UserService.listUsers({
        page,
        limit,
        role: roleParam as Role | undefined,
        search: search || undefined,
      });

      return res.status(200).json(result);
    } catch (error: any) {
      console.error("[USER LIST ERROR]:", error);
      return res.status(500).json({ error: "Erro ao listar usuários." });
    }
  }

  static async stats(req: Request, res: Response) {
    try {
      const result = await UserService.getStats();
      return res.status(200).json(result);
    } catch (error: any) {
      console.error("[USER STATS ERROR]:", error);
      return res.status(500).json({ error: "Erro ao buscar estatísticas de usuários." });
    }
  }

  static async update(req: AuthRequest, res: Response) {
    const id = String(req.params.id);
    const { name, email, role } = req.body ?? {};
    const data: { name?: string; email?: string; role?: Role } = {};

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ error: "Nome não pode ficar vazio." });
      }
      data.name = name.trim();
    }

    if (email !== undefined) {
      if (typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
        return res.status(400).json({ error: "E-mail inválido." });
      }
      data.email = email.trim().toLowerCase();
    }

    if (role !== undefined) {
      const upper = typeof role === "string" ? role.toUpperCase() : "";
      if (!ROLES.includes(upper as Role)) {
        return res.status(400).json({ error: "role deve ser STUDENT, TEACHER ou ADMIN." });
      }
      if (id === req.userId && upper !== "ADMIN") {
        return res.status(400).json({ error: "Você não pode remover o seu próprio perfil de administrador." });
      }
      data.role = upper as Role;
    }

    if (!Object.keys(data).length) {
      return res.status(400).json({ error: "Envie ao menos um campo: name, email ou role." });
    }

    try {
      const user = await UserService.updateUser(id, data);
      return res.status(200).json({ message: "Usuário atualizado.", user });
    } catch (error: any) {
      return UserController.handleError(error, res, "[USER UPDATE ERROR]:", "Erro ao atualizar usuário.");
    }
  }

  static async remove(req: AuthRequest, res: Response) {
    const id = String(req.params.id);

    if (id === req.userId) {
      return res.status(400).json({ error: "Você não pode excluir a sua própria conta." });
    }

    try {
      await UserService.deleteUser(id);
      return res.status(200).json({ message: "Usuário excluído." });
    } catch (error: any) {
      return UserController.handleError(error, res, "[USER DELETE ERROR]:", "Erro ao excluir usuário.");
    }
  }

  private static handleError(error: any, res: Response, tag: string, fallback: string) {
    if (error.message === "Usuário não encontrado.") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === "E-mail já cadastrado.") {
      return res.status(409).json({ error: error.message });
    }
    if (error.message === "Auth Service indisponível.") {
      return res.status(503).json({ error: error.message });
    }
    console.error(tag, error);
    return res.status(500).json({ error: fallback });
  }

  static async updateRole(req: AuthRequest, res: Response) {
    const id = String(req.params.id);
    const role = typeof req.body?.role === "string" ? req.body.role.toUpperCase() : "";

    if (!ROLES.includes(role as Role)) {
      return res.status(400).json({ error: "role deve ser STUDENT, TEACHER ou ADMIN." });
    }

    // Evita que o admin tire o próprio acesso sem querer.
    if (id === req.userId && role !== "ADMIN") {
      return res.status(400).json({ error: "Você não pode remover o seu próprio perfil de administrador." });
    }

    try {
      const user = await UserService.updateRole(id, role as Role);

      return res.status(200).json({
        message: "Perfil atualizado. O usuário precisa fazer login de novo para a mudança valer.",
        user,
      });
    } catch (error: any) {
      if (error.message === "Usuário não encontrado.") {
        return res.status(404).json({ error: error.message });
      }

      console.error("[USER UPDATE ROLE ERROR]:", error);
      return res.status(500).json({ error: "Erro ao atualizar perfil." });
    }
  }
}
