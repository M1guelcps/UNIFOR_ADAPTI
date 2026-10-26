import { prisma } from "../lib/prisma.js";

interface SyncUserDTO {
  id: string;
  name: string;
  email: string;
  role?: "STUDENT" | "TEACHER" | "ADMIN";
}

export class UserService {
  static async syncUser({ id, name, email, role }: SyncUserDTO) {
    // 1. Verifica se o usuário já foi sincronizado
    const userExists = await prisma.user.findUnique({
      where: { id },
    });

    if (userExists) {
      return userExists;
    }

    // 2. Cria o usuário com o MESMO ID do Auth Service
    const user = await prisma.user.create({
      data: {
        id, // ID partilhado!
        name,
        email,
        password: "GERENCIADA_PELO_AUTH", // Placeholder de segurança
        role: role || "STUDENT",
      },
    });

    return user;
  }
}