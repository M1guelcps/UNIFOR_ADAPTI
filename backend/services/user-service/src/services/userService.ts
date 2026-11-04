import { prisma } from "../lib/prisma.js";

type Role = "STUDENT" | "TEACHER" | "ADMIN";

interface SyncUserDTO {
  id: string;
  name: string;
  email: string;
  role?: Role;
}

interface ListUsersDTO {
  page: number;
  limit: number;
  role?: Role;
  search?: string;
}

// Nunca devolvemos o campo password (ele é só um placeholder aqui).
const publicFields = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} as const;

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

  static async getById(id: string) {
    return prisma.user.findUnique({ where: { id }, select: publicFields });
  }

  static async listUsers({ page, limit, role, search }: ListUsersDTO) {
    const where = {
      ...(role ? { role } : {}),
      ...(search
        ? { OR: [{ name: { contains: search } }, { email: { contains: search } }] }
        : {}),
    };

    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        select: publicFields,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  static async getStats() {
    const grouped = await prisma.user.groupBy({
      by: ["role"],
      _count: { _all: true },
    });

    const byRole = { STUDENT: 0, TEACHER: 0, ADMIN: 0 };
    grouped.forEach((g) => {
      byRole[g.role] = g._count._all;
    });

    return {
      total: byRole.STUDENT + byRole.TEACHER + byRole.ADMIN,
      byRole,
    };
  }

  // Nome e e-mail também existem no Auth Service (é lá que o login acontece),
  // então ele é avisado primeiro; se recusar (ex.: e-mail repetido), nada muda aqui.
  static async updateUser(id: string, data: { name?: string; email?: string; role?: Role }) {
    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new Error("Usuário não encontrado.");
    }

    const changedName = data.name !== undefined && data.name !== user.name;
    const changedEmail = data.email !== undefined && data.email !== user.email;

    if (changedName || changedEmail) {
      await callAuthService("PATCH", id, {
        ...(changedName ? { name: data.name } : {}),
        ...(changedEmail ? { email: data.email } : {}),
      });
    }

    return prisma.user.update({
      where: { id },
      data: {
        ...(changedName ? { name: data.name } : {}),
        ...(changedEmail ? { email: data.email } : {}),
        ...(data.role ? { role: data.role } : {}),
      },
      select: publicFields,
    });
  }

  static async deleteUser(id: string) {
    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new Error("Usuário não encontrado.");
    }

    // Remove o login primeiro: se falhar, o usuário continua inteiro nos dois serviços.
    await callAuthService("DELETE", id);
    await prisma.user.delete({ where: { id } });
  }

  static async updateRole(id: string, role: Role) {
    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new Error("Usuário não encontrado.");
    }

    return prisma.user.update({
      where: { id },
      data: { role },
      select: publicFields,
    });
  }
}

// Chamada interna ao Auth Service (rotas /auth/internal/users/:id)
async function callAuthService(method: "PATCH" | "DELETE", id: string, body?: object) {
  const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || "http://localhost:3001";

  let response: Response;
  try {
    response = await fetch(`${AUTH_SERVICE_URL}/auth/internal/users/${id}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Auth Service indisponível.");
  }

  // 404 no DELETE: o login já não existia, então segue para apagar o perfil.
  if (method === "DELETE" && response.status === 404) return;

  if (response.status === 409) {
    throw new Error("E-mail já cadastrado.");
  }

  if (!response.ok) {
    throw new Error("Falha ao sincronizar com o Auth Service.");
  }
}
