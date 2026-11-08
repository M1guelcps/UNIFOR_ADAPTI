import { Navigate, useLocation } from "react-router-dom";
import { DESTINO_POR_PERFIL, useAuth } from "../context/AuthContext.jsx";

// Só evita abrir uma tela que daria erro. A proteção real é a do backend (401/403).
export function RotaProtegida({ perfis, children }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return <Navigate to="/login" replace state={{ de: location.pathname }} />;
  if (perfis && !perfis.includes(user.role)) return <Navigate to={DESTINO_POR_PERFIL[user.role] || "/inicio"} replace />;
  return children;
}

// Login/cadastro: quem já está logado vai direto para a sua tela
export function SomenteVisitante({ children }) {
  const { user } = useAuth();
  if (user) return <Navigate to={DESTINO_POR_PERFIL[user.role] || "/inicio"} replace />;
  return children;
}

export function RedirecionarPorPerfil() {
  const { user } = useAuth();
  return <Navigate to={user ? DESTINO_POR_PERFIL[user.role] || "/inicio" : "/login"} replace />;
}
