import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";

export class AuthService {
  // 1. Rota de Cadastro: Recebe do Frontend, salva a senha e repassa ao User Service
  static async register({
  name,
  email,
  password,
  role
}: {
  name: string;
  email: string;
  password: string;
  role: "STUDENT" | "TEACHER" |"ADMIN";
}) {
  // A. Verifica se o usuário já existe
  const userExists = await prisma.user.findUnique({
    where: { email }
  });

  if (userExists) {
    throw new Error("E-mail já cadastrado.");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  // B. Cria o usuário no Auth Service
  const newUser = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
    },
  });

  // C. Sincroniza com o User Service
  const USER_SERVICE_URL =
    process.env.USER_SERVICE_URL || "http://localhost:3004";

  const syncResponse = await fetch(
    `${USER_SERVICE_URL}/users/internal/sync`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: role
      }),
    }
  );

  if (!syncResponse.ok) {
    throw new Error(
      "Usuário criado no Auth, mas falhou ao sincronizar com o User Service."
    );
  }

  return {
    id: newUser.id,
    name: newUser.name,
    email: newUser.email,
    role
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

    // 3. Busca o perfil (role), que fica no User Service
    const role = await AuthService.fetchRole(user.id);

    const secret = process.env.JWT_SECRET || "default_secret";

    const expiresIn = (process.env.JWT_EXPIRES_IN || "1d") as SignOptions["expiresIn"];

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role },
      secret,
      { expiresIn }
    );

    return {
      token,
      user: { id: user.id, name: user.name, email: user.email, role }
    };
  }

  // 3. Rotas internas: o User Service avisa quando o admin edita ou exclui alguém.
  static async updateCredentials(id: string, { name, email }: { name?: string; email?: string }) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new Error("Usuário não encontrado.");
    }

    if (email && email !== user.email) {
      const emailInUse = await prisma.user.findUnique({ where: { email } });
      if (emailInUse) {
        throw new Error("E-mail já cadastrado.");
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { ...(name ? { name } : {}), ...(email ? { email } : {}) },
    });

    return { id: updated.id, name: updated.name, email: updated.email };
  }

  static async deleteCredentials(id: string) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new Error("Usuário não encontrado.");
    }

    await prisma.user.delete({ where: { id } });
  }

  // Se o User Service não responder, o usuário entra com o menor privilégio (aluno).
  private static async fetchRole(userId: string): Promise<string> {
    const USER_SERVICE_URL = process.env.USER_SERVICE_URL || "http://localhost:3004";

    try {
      const response = await fetch(`${USER_SERVICE_URL}/users/internal/${userId}`);

      if (!response.ok) {
        console.warn(`[AUTH] User Service respondeu ${response.status} ao buscar role.`);
        return "STUDENT";
      }

      const data = (await response.json()) as { role?: string };
      return data.role || "STUDENT";
    } catch (error: any) {
      console.warn("[AUTH] User Service indisponível ao buscar role:", error.message);
      return "STUDENT";
    }
  }
}