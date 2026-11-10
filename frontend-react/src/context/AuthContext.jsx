import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, definirAoExpirar, TOKEN_KEY, USER_KEY } from "../api/client.js";

const AuthContext = createContext(null);

export const DESTINO_POR_PERFIL = {
  ADMIN: "/admin",
  TEACHER: "/professor",
  STUDENT: "/inicio",
};

export const NOMES_PERFIL = {
  STUDENT: "Aluno",
  TEACHER: "Professor",
  ADMIN: "Administrador",
};

// Lê o "exp" do JWT (sem validar assinatura; quem valida é o backend).
function tokenExpirado(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.exp ? payload.exp * 1000 < Date.now() : false;
  } catch {
    return true;
  }
}

function lerSessao() {
  const token = localStorage.getItem(TOKEN_KEY);
  const userStr = localStorage.getItem(USER_KEY);
  if (!token || !userStr || tokenExpirado(token)) return null;
  try {
    const user = JSON.parse(userStr);
    return { token, user: { ...user, role: user.role || "STUDENT" } };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [sessao, setSessao] = useState(lerSessao);
  const [expirou, setExpirou] = useState(false);

  const sair = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setSessao(null);
  }, []);

  useEffect(() => {
    definirAoExpirar(() => {
      setExpirou(true);
      sair();
    });
  }, [sair]);

  const entrar = useCallback(async (email, password) => {
    const data = await api("/auth/login", { method: "POST", body: { email, password }, auth: false });
    const user = { ...data.user, role: data.user.role || "STUDENT" };
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    setExpirou(false);
    setSessao({ token: data.token, user });
    return user;
  }, []);

  const valor = useMemo(
    () => ({ user: sessao?.user ?? null, entrar, sair, expirou, limparExpirou: () => setExpirou(false) }),
    [sessao, entrar, sair, expirou]
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
