// Utilitários compartilhados pelas telas de Admin e Professor.
const API_BASE = "http://localhost:3000";

const DESTINO_POR_PERFIL = {
  ADMIN: "admin.html",
  TEACHER: "professor.html",
  STUDENT: "inicio.html",
};

const NOMES_PERFIL = {
  STUDENT: "Aluno",
  TEACHER: "Professor",
  ADMIN: "Administrador",
};

function sair() {
  localStorage.removeItem("@adapti:token");
  localStorage.removeItem("@adapti:user");
  window.location.href = "login.html";
}

// Garante que há sessão e que o perfil pode ver a página.
// A proteção de verdade é feita no backend (403); isto só evita a tela "quebrada".
function protegerPagina(perfisPermitidos) {
  const token = localStorage.getItem("@adapti:token");
  const userStr = localStorage.getItem("@adapti:user");

  if (!token || !userStr) {
    window.location.href = "login.html";
    return null;
  }

  let user;
  try {
    user = JSON.parse(userStr);
  } catch {
    sair();
    return null;
  }

  const role = user.role || "STUDENT";
  if (!perfisPermitidos.includes(role)) {
    window.location.href = DESTINO_POR_PERFIL[role] || "inicio.html";
    return null;
  }

  return { token, user: { ...user, role } };
}

// fetch autenticado: injeta o token, converte JSON e trata 401/403.
async function apiAuth(caminho, { method = "GET", body } = {}) {
  const token = localStorage.getItem("@adapti:token");

  const response = await fetch(`${API_BASE}${caminho}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401) {
    sair();
    throw new Error("Sessão expirada. Faça login novamente.");
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    // resposta sem corpo JSON (ex.: gateway fora do ar)
  }

  if (!response.ok) {
    throw new Error((data && data.error) || `Erro ${response.status} no servidor.`);
  }

  return data;
}

function escaparHtml(texto) {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Enunciados do ENEM vêm com markdown/imagens; para listas mostramos um resumo.
function resumirTexto(texto, max = 110) {
  const limpo = String(texto ?? "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "[imagem]")
    .replace(/[#*_>`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return limpo.length > max ? `${limpo.slice(0, max)}…` : limpo;
}

function formatarData(iso) {
  return iso ? new Date(iso).toLocaleDateString("pt-BR") : "-";
}

// Mensagem de feedback (sucesso/erro) num elemento .aviso
function mostrarAviso(elemento, texto, tipo = "sucesso") {
  elemento.textContent = texto;
  elemento.className = `aviso ${tipo}`;
  elemento.hidden = false;
  clearTimeout(elemento._timer);
  elemento._timer = setTimeout(() => (elemento.hidden = true), 5000);
}

// Abas do painel: o menu lateral troca a seção visível (e lembra no #hash).
function iniciarAbas(abaPadrao, aoTrocar) {
  const itens = document.querySelectorAll(".menu-item[data-aba]");
  const abas = document.querySelectorAll(".painel-aba");

  function ativar(nome) {
    if (!document.getElementById(`aba-${nome}`)) nome = abaPadrao;
    abas.forEach((a) => (a.hidden = a.id !== `aba-${nome}`));
    itens.forEach((i) => {
      const ativo = i.dataset.aba === nome;
      i.classList.toggle("ativo", ativo);
      if (ativo) i.setAttribute("aria-current", "page");
      else i.removeAttribute("aria-current");
    });
    if (aoTrocar) aoTrocar(nome);
  }

  itens.forEach((item) =>
    item.addEventListener("click", (e) => {
      e.preventDefault();
      history.replaceState(null, "", `#${item.dataset.aba}`);
      ativar(item.dataset.aba);
    })
  );

  ativar(location.hash.slice(1) || abaPadrao);
  return ativar;
}

// Linhas de barra horizontais (reaproveita o visual da tela de desempenho)
function renderizarBarras(lista, itens, { rotulo, valor, total, texto }) {
  if (!itens.length) {
    lista.innerHTML = `<li class="vazio">Sem dados ainda.</li>`;
    return;
  }
  const maior = Math.max(...itens.map((i) => (total ? total(i) : valor(i))), 1);
  lista.innerHTML = itens
    .map((i) => {
      const largura = total ? (valor(i) / Math.max(total(i), 1)) * 100 : (valor(i) / maior) * 100;
      return `
        <li class="barra-linha">
          <span class="barra-rotulo" title="${escaparHtml(rotulo(i))}">${escaparHtml(rotulo(i))}</span>
          <span class="barra-fundo"><span class="barra-cheia" style="width:${largura.toFixed(1)}%"></span></span>
          <span class="barra-numero">${escaparHtml(texto ? texto(i) : valor(i))}</span>
        </li>`;
    })
    .join("");
}

function renderizarPaginacao(container, meta, aoMudar) {
  if (!meta || meta.totalPages <= 1) {
    container.innerHTML = "";
    return;
  }
  container.innerHTML = `
    <button type="button" class="botao-pequeno" data-p="${meta.page - 1}" ${meta.page <= 1 ? "disabled" : ""}>Anterior</button>
    <span>Página ${meta.page} de ${meta.totalPages}</span>
    <button type="button" class="botao-pequeno" data-p="${meta.page + 1}" ${meta.page >= meta.totalPages ? "disabled" : ""}>Próxima</button>`;
  container.querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", () => aoMudar(Number(b.dataset.p)))
  );
}
