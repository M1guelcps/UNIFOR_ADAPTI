import { useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { NOMES_PERFIL, useAuth } from "../context/AuthContext.jsx";
import { IconeSair } from "./Icones.jsx";

export function useTitulo(titulo) {
  useEffect(() => {
    document.title = titulo ? `${titulo} | ADAPTI` : "ADAPTI";
  }, [titulo]);
}

function iniciais(nome) {
  const partes = String(nome ?? "").trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "?";
  return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
}

// Telas de login, cadastro e senha: painel da marca + formulário
export function LayoutAcesso({ classe, children }) {
  return (
    <div className="acesso">
      <aside className="acesso-marca" aria-hidden="true">
        <span className="acesso-logo">
          <img src="/assets/logo-adapti.png" alt="" />
        </span>
        <div className="acesso-texto">
          <h2>Aprenda no seu ritmo, com questões reais do ENEM.</h2>
          <p>Pratique, acompanhe sua evolução e descubra onde focar os estudos.</p>
          <ul className="acesso-lista">
            <li>Questões do ENEM separadas por área e ano</li>
            <li>Simulados com cronômetro e correção no final</li>
            <li>Desempenho por área para saber o que revisar</li>
          </ul>
        </div>
        <p className="acesso-rodape">ADAPTI · UNIFOR</p>
      </aside>

      <main className="acesso-form">
        <div className={`caixa ${classe}`}>
          <img className="logo" src="/assets/logo-adapti.png" alt="ADAPTI" />
          {children}
        </div>
      </main>
    </div>
  );
}

// Telas internas: menu lateral (barra inferior no celular) + conteúdo
// itens: [{ to, rotulo, Icone, end? }]
export function LayoutApp({ itens, rotuloMenu = "Menu principal" }) {
  const { user, sair } = useAuth();
  const navigate = useNavigate();

  function aoSair() {
    sair();
    navigate("/login", { replace: true });
  }

  return (
    <div className="app-shell">
      <nav className="menu" aria-label={rotuloMenu}>
        <img className="menu-logo" src="/assets/logo-adapti.png" alt="ADAPTI" />
        <p className="menu-secao">Menu</p>
        <div className="menu-lista">
          {itens.map(({ to, rotulo, Icone, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `menu-item${isActive ? " ativo" : ""}`}>
              <Icone />
              <span className="menu-texto">{rotulo}</span>
            </NavLink>
          ))}
        </div>

        <div className="menu-usuario">
          <span className="avatar" aria-hidden="true">{iniciais(user?.name)}</span>
          <div className="menu-usuario-texto">
            <p className="menu-usuario-nome" title={user?.email}>{user?.name}</p>
            <p className="menu-usuario-perfil">{NOMES_PERFIL[user?.role] ?? ""}</p>
          </div>
          <button type="button" className="menu-sair" onClick={aoSair} aria-label="Sair" title="Sair">
            <IconeSair />
          </button>
        </div>
      </nav>

      <div className="painel">
        <header className="topo-movel">
          <img src="/assets/logo-adapti.png" alt="ADAPTI" />
          <button type="button" className="menu-sair" onClick={aoSair}>
            <IconeSair /> Sair
          </button>
        </header>
        <main className="painel-conteudo">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
