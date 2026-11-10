// Cliente único para o API Gateway. Toda chamada passa por aqui.
export const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

// Mesmas chaves do frontend antigo: quem já estava logado continua logado.
export const TOKEN_KEY = "@adapti:token";
export const USER_KEY = "@adapti:user";

// Avisado quando a API devolve 401 (o AuthContext escuta e faz logout).
let aoExpirar = () => {};
export function definirAoExpirar(fn) {
  aoExpirar = fn;
}

export async function api(caminho, { method = "GET", body, auth = true, signal } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = localStorage.getItem(TOKEN_KEY);
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_BASE}${caminho}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (erro) {
    if (erro.name === "AbortError") throw erro;
    throw new Error("Não foi possível conectar ao servidor. Verifique se o Gateway está rodando.");
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    // resposta sem corpo JSON (ex.: 204 ou gateway fora do ar)
  }

  if (response.status === 401 && auth) {
    aoExpirar();
    throw new Error("Sua sessão expirou. Entre novamente.");
  }

  if (!response.ok) {
    throw new Error((data && data.error) || `Erro ${response.status} no servidor.`);
  }

  return data;
}
