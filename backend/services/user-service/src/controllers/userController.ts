import { Request, Response } from "express";
import { UserService } from "../services/userService.js";

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
}