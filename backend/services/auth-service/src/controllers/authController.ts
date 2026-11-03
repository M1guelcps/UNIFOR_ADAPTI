import { Request, Response } from "express";
import { AuthService } from "../services/authService.js";

export class AuthController {
  static async register(req: Request, res: Response) {
    try {
      const { name, email, password, role } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({ error: "Nome, e-mail e senha são obrigatórios." });
      }

      // Chama o AuthService para criar o usuário local e sincronizar com o User Service
      const user = await AuthService.register({ name, email, password, role });

      return res.status(201).json({
        message: "Usuário registrado com sucesso!",
        user
      });
    } catch (error: any) {
      console.error("[AUTH REGISTER ERROR]:", error.message);
      return res.status(400).json({ error: error.message || "Erro ao registrar usuário." });
    }
  }

  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "E-mail e senha são obrigatórios." });
      }

      // Chama o AuthService para validar as credenciais no User Service e gerar o JWT
      const result = await AuthService.login(email, password);

      return res.status(200).json(result);
    } catch (error: any) {
      console.error("[AUTH LOGIN ERROR]:", error.message);
      // Retorna 401 Unauthorized para falhas de autenticação
      return res.status(401).json({ error: error.message || "Credenciais inválidas." });
    }
  }

  // Interna: chamada pelo User Service quando o admin edita nome/e-mail
  static async internalUpdate(req: Request, res: Response) {
    try {
      const { name, email } = req.body ?? {};
      const user = await AuthService.updateCredentials(String(req.params.id), { name, email });
      return res.status(200).json(user);
    } catch (error: any) {
      return AuthController.internalError(error, res, "[AUTH INTERNAL UPDATE ERROR]:");
    }
  }

  // Interna: chamada pelo User Service quando o admin exclui um usuário
  static async internalDelete(req: Request, res: Response) {
    try {
      await AuthService.deleteCredentials(String(req.params.id));
      return res.status(204).send();
    } catch (error: any) {
      return AuthController.internalError(error, res, "[AUTH INTERNAL DELETE ERROR]:");
    }
  }

  private static internalError(error: any, res: Response, tag: string) {
    if (error.message === "Usuário não encontrado.") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === "E-mail já cadastrado.") {
      return res.status(409).json({ error: error.message });
    }
    console.error(tag, error);
    return res.status(500).json({ error: "Erro interno no Auth Service." });
  }
}