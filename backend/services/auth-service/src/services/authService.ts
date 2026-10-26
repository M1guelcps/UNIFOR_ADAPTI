import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";

export class AuthService {
  // 1. Rota de Cadastro: Recebe do Frontend, salva a senha e repassa ao User Service
  static async register({ name, email, password, role }: Record<string, string>) {
    // A. Verifica e cria no banco local do Auth Service (adapti_auth)
    const userExists = await prisma.user.findUnique({ where: { email } });
    if (userExists) {
      throw new Error("E-mail já cadastrado.");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
    });

    // B. Repassa as informações para o User Service criar o perfil dele lá
    const USER_SERVICE_URL = process.env.USER_SERVICE_URL || "http://localhost:3004";
    
    const syncResponse = await fetch(`${USER_SERVICE_URL}/users/internal/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: newUser.id, // Repassamos o mesmo ID gerado aqui!
        name: newUser.name,
        email: newUser.email,
        role: role || "STUDENT"
      }),
    });

    if (!syncResponse.ok) {
      // Em sistemas avançados, se falhar aqui, apagamos o usuário do Auth (Rollback)
      throw new Error("Usuário criado no Auth, mas falhou ao sincronizar com o User Service.");
    }

    return {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
    };
  }

  // 2. Rota de Login: Mantemos como ajustamos antes (chama o User Service para validar)
 // src/services/authService.ts (No Auth Service)
  static async login(email: string, pass: string) {
    // 1. Busca no banco adapti_auth (onde a senha real está)
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new Error("Credenciais inválidas.");
    }

    // 2. Valida o hash bcrypt localmente
    const passwordMatch = await bcrypt.compare(pass, user.password);

    if (!passwordMatch) {
      throw new Error("Credenciais inválidas.");
    }

    // 3. Opcional: Se precisar da "role" (que fica no User Service), você faria um fetch(GET /users/:id) aqui.
    // Como o name já está no Auth Service para simplificar, você já pode gerar o token direto!
    const secret = process.env.JWT_SECRET || "default_secret";

    const expiresIn = (process.env.JWT_EXPIRES_IN || "1d") as SignOptions["expiresIn"];

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      secret,
      { expiresIn }
    );

    return { 
      token, 
      user: { id: user.id, name: user.name, email: user.email } 
    };
  }
}