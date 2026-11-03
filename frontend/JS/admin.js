document.addEventListener("DOMContentLoaded", () => {
  const sessao = protegerPagina(["ADMIN"]);
  if (!sessao) return;

  const aviso = document.getElementById("aviso-global");
  const primeiroNome = (sessao.user.name || "").split(" ")[0];
  document.getElementById("user-name").textContent = `Olá, ${primeiroNome} 👋`;

  document.getElementById("btn-logout").addEventListener("click", (e) => {
    e.preventDefault();
    sair();
  });

  // Abas já carregadas (cada aba busca seus dados só na primeira vez)
  const carregadas = new Set();

  // ===================== VISÃO GERAL =====================

  async function carregarVisaoGeral() {
    // As três chamadas vão para serviços diferentes; uma falhar não derruba as outras.
    const [usuarios, questoes, respostas] = await Promise.allSettled([
      apiAuth("/users/stats"),
      apiAuth("/quests/stats"),
      apiAuth("/answers/admin/stats"),
    ]);

    if (usuarios.status === "fulfilled") {
      const u = usuarios.value;
      document.getElementById("stat-usuarios").textContent = u.total;
      renderizarBarras(
        document.getElementById("lista-perfis"),
        [
          { nome: "Alunos", n: u.byRole.STUDENT },
          { nome: "Professores", n: u.byRole.TEACHER },
          { nome: "Administradores", n: u.byRole.ADMIN },
        ],
        { rotulo: (i) => i.nome, valor: (i) => i.n }
      );
    } else {
      falhou("lista-perfis", "stat-usuarios", usuarios.reason);
    }

    if (questoes.status === "fulfilled") {
      const q = questoes.value;
      document.getElementById("stat-questoes").textContent = q.total;
      renderizarBarras(document.getElementById("lista-fontes"), q.bySource, {
        rotulo: (i) => i.source,
        valor: (i) => i.count,
      });
    } else {
      falhou("lista-fontes", "stat-questoes", questoes.reason);
    }

    if (respostas.status === "fulfilled") {
      const r = respostas.value;
      document.getElementById("stat-respostas").textContent = r.summary.totalAnswers;
      document.getElementById("stat-acerto").textContent = r.summary.accuracy.replace(".0", "");
      renderizarBarras(document.getElementById("lista-areas"), r.byArea, {
        rotulo: (i) => i.area,
        valor: (i) => i.correct,
        total: (i) => i.total,
        texto: (i) => i.accuracy.replace(".0", ""),
      });
      renderizarBarras(document.getElementById("lista-dias"), r.last7Days, {
        rotulo: (i) => new Date(`${i.date}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" }),
        valor: (i) => i.total,
      });
    } else {
      falhou("lista-areas", "stat-respostas", respostas.reason);
      falhou("lista-dias", "stat-acerto", respostas.reason);
    }
  }

  function falhou(listaId, statId, erro) {
    document.getElementById(listaId).innerHTML = `<li class="vazio erro">${escaparHtml(erro.message)}</li>`;
    document.getElementById(statId).textContent = "–";
  }

  // ===================== USUÁRIOS =====================

  const tabelaUsuarios = document.getElementById("tabela-usuarios");
  let paginaUsuarios = 1;
  let usuariosNaTela = []; // dados da página atual, usados ao abrir o modal de edição

  document.getElementById("form-filtro-usuarios").addEventListener("submit", (e) => {
    e.preventDefault();
    carregarUsuarios(1);
  });
  document.getElementById("filtro-perfil").addEventListener("change", () => carregarUsuarios(1));

  async function carregarUsuarios(pagina) {
    paginaUsuarios = pagina;
    const params = new URLSearchParams({ page: pagina, limit: 10 });
    const busca = document.getElementById("busca-usuario").value.trim();
    const perfil = document.getElementById("filtro-perfil").value;
    if (busca) params.set("search", busca);
    if (perfil) params.set("role", perfil);

    tabelaUsuarios.innerHTML = `<tr><td colspan="5" class="vazio">Carregando…</td></tr>`;

    try {
      const { data, meta } = await apiAuth(`/users?${params}`);
      usuariosNaTela = data;

      if (!data.length) {
        tabelaUsuarios.innerHTML = `<tr><td colspan="5" class="vazio">Nenhum usuário encontrado.</td></tr>`;
      } else {
        tabelaUsuarios.innerHTML = data.map(linhaUsuario).join("");
      }
      renderizarPaginacao(document.getElementById("paginacao-usuarios"), meta, carregarUsuarios);
    } catch (erro) {
      tabelaUsuarios.innerHTML = `<tr><td colspan="5" class="vazio erro">${escaparHtml(erro.message)}</td></tr>`;
    }
  }

  function linhaUsuario(u) {
    const ehVoce = u.id === sessao.user.id;
    const opcoes = Object.entries(NOMES_PERFIL)
      .map(([valor, nome]) => `<option value="${valor}" ${u.role === valor ? "selected" : ""}>${nome}</option>`)
      .join("");

    return `
      <tr>
        <td data-rotulo="Nome"><strong>${escaparHtml(u.name)}</strong>${ehVoce ? ' <span class="selo">você</span>' : ""}</td>
        <td data-rotulo="E-mail">${escaparHtml(u.email)}</td>
        <td data-rotulo="Cadastro">${formatarData(u.createdAt)}</td>
        <td data-rotulo="Perfil">
          <label class="oculto" for="perfil-${u.id}">Perfil de ${escaparHtml(u.name)}</label>
          <select class="seletor pequeno" id="perfil-${u.id}" data-id="${u.id}" data-atual="${u.role}" ${ehVoce ? "disabled" : ""}>
            ${opcoes}
          </select>
        </td>
        <td class="acoes">
          <button type="button" class="botao-pequeno" data-editar-usuario="${u.id}">Editar</button>
          <button type="button" class="botao-pequeno perigo" data-excluir-usuario="${u.id}" ${ehVoce ? 'disabled title="Você não pode excluir a própria conta"' : ""}>Excluir</button>
        </td>
      </tr>`;
  }

  tabelaUsuarios.addEventListener("change", async (e) => {
    const select = e.target.closest("select[data-id]");
    if (!select) return;

    const novo = select.value;
    const nome = select.closest("tr").querySelector("strong").textContent;

    if (!confirm(`Alterar o perfil de ${nome} para ${NOMES_PERFIL[novo]}?`)) {
      select.value = select.dataset.atual;
      return;
    }

    select.disabled = true;
    try {
      await apiAuth(`/users/${select.dataset.id}/role`, { method: "PATCH", body: { role: novo } });
      select.dataset.atual = novo;
      mostrarAviso(aviso, `${nome} agora é ${NOMES_PERFIL[novo]}. A mudança vale no próximo login.`);
      carregadas.delete("visao"); // contagem por perfil mudou
    } catch (erro) {
      select.value = select.dataset.atual;
      mostrarAviso(aviso, erro.message, "erro");
    } finally {
      select.disabled = false;
    }
  });

  tabelaUsuarios.addEventListener("click", async (e) => {
    const editar = e.target.closest("button[data-editar-usuario]");
    const excluir = e.target.closest("button[data-excluir-usuario]");

    if (editar) {
      abrirModalUsuario(usuariosNaTela.find((u) => u.id === editar.dataset.editarUsuario));
    }

    if (excluir) {
      const u = usuariosNaTela.find((x) => x.id === excluir.dataset.excluirUsuario);
      if (!confirm(`Excluir ${u.name} (${u.email})? A pessoa não vai mais conseguir entrar. Isso não pode ser desfeito.`)) return;

      excluir.disabled = true;
      try {
        await apiAuth(`/users/${u.id}`, { method: "DELETE" });
        mostrarAviso(aviso, `${u.name} foi excluído(a).`);
        carregadas.delete("visao");
        // se era o último da página, volta uma página
        carregarUsuarios(usuariosNaTela.length === 1 && paginaUsuarios > 1 ? paginaUsuarios - 1 : paginaUsuarios);
      } catch (erro) {
        excluir.disabled = false;
        mostrarAviso(aviso, erro.message, "erro");
      }
    }
  });

  // ---------- Modal de usuário ----------

  const modalUsuario = document.getElementById("modal-usuario");
  const formUsuario = document.getElementById("form-usuario");
  const erroUsuario = document.getElementById("erro-usuario");
  let usuarioEditando = null;

  function abrirModalUsuario(u) {
    usuarioEditando = u;
    erroUsuario.hidden = true;
    document.getElementById("usuario-nome").value = u.name;
    document.getElementById("usuario-email").value = u.email;
    const perfil = document.getElementById("usuario-perfil");
    perfil.value = u.role;
    perfil.disabled = u.id === sessao.user.id; // não tira o próprio admin
    modalUsuario.showModal();
  }

  formUsuario.addEventListener("submit", async (e) => {
    e.preventDefault();
    erroUsuario.hidden = true;

    const body = {
      name: document.getElementById("usuario-nome").value.trim(),
      email: document.getElementById("usuario-email").value.trim(),
    };
    const perfil = document.getElementById("usuario-perfil");
    if (!perfil.disabled) body.role = perfil.value;

    if (!body.name || !body.email) {
      erroUsuario.textContent = "Preencha nome e e-mail.";
      erroUsuario.hidden = false;
      return;
    }

    const botao = document.getElementById("btn-salvar-usuario");
    botao.disabled = true;
    try {
      await apiAuth(`/users/${usuarioEditando.id}`, { method: "PUT", body });
      modalUsuario.close();
      mostrarAviso(aviso, `Dados de ${body.name} atualizados.`);
      carregadas.delete("visao");
      carregarUsuarios(paginaUsuarios);
    } catch (erro) {
      erroUsuario.textContent = erro.message;
      erroUsuario.hidden = false;
    } finally {
      botao.disabled = false;
    }
  });

  // ===================== QUESTÕES =====================

  const tabelaQuestoes = document.getElementById("tabela-questoes");
  let paginaQuestoes = 1;

  async function carregarQuestoes(pagina) {
    paginaQuestoes = pagina;
    tabelaQuestoes.innerHTML = `<tr><td colspan="5" class="vazio">Carregando…</td></tr>`;

    try {
      const { data, meta } = await apiAuth(`/quests?page=${pagina}&limit=10`);

      if (!data.length) {
        tabelaQuestoes.innerHTML = `<tr><td colspan="5" class="vazio">Nenhuma questão cadastrada. Importe do ENEM acima.</td></tr>`;
      } else {
        tabelaQuestoes.innerHTML = data
          .map(
            (q) => `
          <tr>
            <td data-rotulo="Enunciado" class="celula-texto">${escaparHtml(resumirTexto(q.statement))}</td>
            <td data-rotulo="Área">${escaparHtml(q.area || "-")}</td>
            <td data-rotulo="Fonte">${escaparHtml(q.source || "-")}${q.creatorId ? ' <span class="selo">autoral</span>' : ""}</td>
            <td data-rotulo="Gabarito"><span class="letra">${escaparHtml(q.correctOption)}</span></td>
            <td class="acoes">
              <button type="button" class="botao-pequeno" data-editar="${q.id}">Editar</button>
              <button type="button" class="botao-pequeno perigo" data-excluir="${q.id}">Excluir</button>
            </td>
          </tr>`
          )
          .join("");
      }
      renderizarPaginacao(document.getElementById("paginacao-questoes"), meta, carregarQuestoes);
    } catch (erro) {
      tabelaQuestoes.innerHTML = `<tr><td colspan="5" class="vazio erro">${escaparHtml(erro.message)}</td></tr>`;
    }
  }

  tabelaQuestoes.addEventListener("click", async (e) => {
    const editar = e.target.closest("button[data-editar]");
    if (editar) {
      editar.disabled = true;
      try {
        abrirModalQuestao(await apiAuth(`/quests/${editar.dataset.editar}`));
      } catch (erro) {
        mostrarAviso(aviso, erro.message, "erro");
      } finally {
        editar.disabled = false;
      }
      return;
    }

    const botao = e.target.closest("button[data-excluir]");
    if (!botao) return;

    if (!confirm("Excluir esta questão? As respostas dos alunos para ela também serão apagadas.")) return;

    botao.disabled = true;
    try {
      const r = await apiAuth(`/quests/${botao.dataset.excluir}`, { method: "DELETE" });
      mostrarAviso(aviso, `Questão excluída (${r.deletedAnswers} resposta(s) removidas).`);
      carregadas.delete("visao");
      carregarQuestoes(paginaQuestoes);
    } catch (erro) {
      botao.disabled = false;
      mostrarAviso(aviso, erro.message, "erro");
    }
  });

  // ---------- Modal de questão ----------

  const LETRAS = ["A", "B", "C", "D", "E"];
  const modalQuestao = document.getElementById("modal-questao");
  const formQuestao = document.getElementById("form-questao");
  const erroQuestao = document.getElementById("erro-questao");
  let questaoEditando = null;

  document.getElementById("questao-alternativas").innerHTML = LETRAS.map(
    (letra) => `
    <div class="alternativa-linha">
      <label class="marcar-correta" title="Marcar ${letra} como correta">
        <input type="radio" name="questao-correta" value="${letra}">
        <span>${letra}</span>
        <span class="oculto">Marcar ${letra} como correta</span>
      </label>
      <div class="campo">
        <label class="oculto" for="questao-alt-${letra}">Texto da alternativa ${letra}</label>
        <input id="questao-alt-${letra}" type="text" placeholder="Alternativa ${letra}">
      </div>
    </div>`
  ).join("");

  function abrirModalQuestao(q) {
    questaoEditando = q;
    formQuestao.reset();
    erroQuestao.hidden = true;

    document.getElementById("questao-enunciado").value = q.statement || "";
    document.getElementById("questao-fonte").value = q.source || "";

    const area = document.getElementById("questao-area");
    if (q.area && ![...area.options].some((o) => o.value === q.area)) {
      area.add(new Option(q.area, q.area)); // área vinda do ENEM, fora da lista padrão
    }
    area.value = q.area || "linguagens";

    (Array.isArray(q.options) ? q.options : []).slice(0, LETRAS.length).forEach((opcao, i) => {
      document.getElementById(`questao-alt-${LETRAS[i]}`).value =
        typeof opcao === "string" ? opcao : opcao.text || "";
    });
    const radio = formQuestao.querySelector(`input[name="questao-correta"][value="${q.correctOption}"]`);
    if (radio) radio.checked = true;

    modalQuestao.showModal();
  }

  formQuestao.addEventListener("submit", async (e) => {
    e.preventDefault();
    erroQuestao.hidden = true;

    const statement = document.getElementById("questao-enunciado").value.trim();
    const marcada = formQuestao.querySelector('input[name="questao-correta"]:checked')?.value;
    const preenchidas = LETRAS
      .map((letra) => ({ letra, texto: document.getElementById(`questao-alt-${letra}`).value.trim() }))
      .filter((a) => a.texto);
    const indiceCorreta = preenchidas.findIndex((a) => a.letra === marcada);

    const falha = !statement ? "Escreva o enunciado."
      : preenchidas.length < 2 ? "Preencha pelo menos duas alternativas."
      : !marcada ? "Marque a alternativa correta."
      : indiceCorreta === -1 ? `A alternativa ${marcada}, marcada como correta, está vazia.`
      : null;
    if (falha) {
      erroQuestao.textContent = falha;
      erroQuestao.hidden = false;
      return;
    }

    const botao = document.getElementById("btn-salvar-questao");
    botao.disabled = true;
    try {
      await apiAuth(`/quests/${questaoEditando.id}`, {
        method: "PUT",
        body: {
          statement,
          options: preenchidas.map((a) => a.texto),
          correctOption: LETRAS[indiceCorreta],
          area: document.getElementById("questao-area").value,
          source: document.getElementById("questao-fonte").value.trim(),
        },
      });
      modalQuestao.close();
      mostrarAviso(aviso, "Questão atualizada!");
      carregarQuestoes(paginaQuestoes);
    } catch (erro) {
      erroQuestao.textContent = erro.message;
      erroQuestao.hidden = false;
    } finally {
      botao.disabled = false;
    }
  });

  // Botões "Cancelar" dos modais
  document.querySelectorAll("dialog [data-fechar]").forEach((b) =>
    b.addEventListener("click", () => b.closest("dialog").close())
  );

  document.getElementById("form-importar").addEventListener("submit", async (e) => {
    e.preventDefault();
    const botao = document.getElementById("btn-importar");
    const ano = document.getElementById("ano-importar").value;

    botao.disabled = true;
    botao.textContent = "Importando…";
    try {
      const r = await apiAuth(`/quests/import/enem?year=${ano}`, { method: "POST" });
      mostrarAviso(aviso, `${r.message} (${r.count} novas)`);
      carregadas.delete("visao");
      carregarQuestoes(1);
    } catch (erro) {
      mostrarAviso(aviso, erro.message, "erro");
    } finally {
      botao.disabled = false;
      botao.textContent = "Importar";
    }
  });

  // Por último: só agora todas as funções e elementos acima existem.
  iniciarAbas("visao", (aba) => {
    if (carregadas.has(aba)) return;
    carregadas.add(aba);
    if (aba === "visao") carregarVisaoGeral();
    if (aba === "usuarios") carregarUsuarios(1);
    if (aba === "questoes") carregarQuestoes(1);
  });
});
