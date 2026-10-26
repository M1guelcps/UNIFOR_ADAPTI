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
}