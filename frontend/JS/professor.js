const LETRAS = ["A", "B", "C", "D", "E"];

const NOMES_AREA = {
  linguagens: "Linguagens",
  humanas: "Humanas",
  natureza: "Natureza",
  matematica: "Matemática",
};

document.addEventListener("DOMContentLoaded", () => {
  const sessao = protegerPagina(["TEACHER", "ADMIN"]);
  if (!sessao) return;

  const aviso = document.getElementById("aviso-global");
  const primeiroNome = (sessao.user.name || "").split(" ")[0];
  document.getElementById("user-name").textContent = `Olá, ${primeiroNome} 👋`;

  if (sessao.user.role === "ADMIN") {
    document.getElementById("link-admin").hidden = false;
    const selo = document.getElementById("selo-perfil");
    selo.textContent = "Administrador";
    selo.className = "selo selo-admin";
  }

  document.getElementById("btn-logout").addEventListener("click", (e) => {
    e.preventDefault();
    sair();
  });

  // Estatísticas por questão (vem do Answer Service), indexadas pelo id
  let estatisticas = new Map();
  let paginaAtual = 1;
  let editandoId = null;
  let irPara; // definido no fim, depois que tudo abaixo existe

  // Botões/atalhos que levam para outra aba
  document.querySelectorAll("[data-ir]").forEach((el) =>
    el.addEventListener("click", (e) => {
      e.preventDefault();
      if (el.dataset.ir === "nova") limparFormulario();
      history.replaceState(null, "", `#${el.dataset.ir}`);
      irPara(el.dataset.ir);
    })
  );

  // ===================== RESUMO =====================

  async function buscarEstatisticas() {
    const dados = await apiAuth("/answers/teacher/stats");
    estatisticas = new Map(dados.perQuest.map((q) => [q.questId, q]));
    return dados;
  }

  async function carregarResumo() {
    const lista = document.getElementById("lista-dificeis");
    try {
      const { summary, perQuest } = await buscarEstatisticas();

      document.getElementById("stat-questoes").textContent = summary.totalQuests;
      document.getElementById("stat-respostas").textContent = summary.totalAnswers;
      document.getElementById("stat-alunos").textContent = summary.uniqueStudents;
      document.getElementById("stat-acerto").textContent = summary.accuracy.replace(".0", "");

      const dificeis = perQuest
        .filter((q) => q.totalAnswers > 0)
        .sort((a, b) => parseFloat(a.accuracy) - parseFloat(b.accuracy))
        .slice(0, 5);

      if (!perQuest.length) {
        lista.innerHTML = `<li class="vazio">Você ainda não criou questões. <a href="#nova" data-ir-inline="nova">Crie a primeira</a>.</li>`;
      } else if (!dificeis.length) {
        lista.innerHTML = `<li class="vazio">Suas questões ainda não foram respondidas.</li>`;
      } else {
        renderizarBarras(lista, dificeis, {
          rotulo: (q) => resumirTexto(q.statement, 60),
          valor: (q) => q.correct,
          total: (q) => q.totalAnswers,
          texto: (q) => `${q.accuracy.replace(".0", "")} de ${q.totalAnswers}`,
        });
      }
    } catch (erro) {
      lista.innerHTML = `<li class="vazio erro">${escaparHtml(erro.message)}</li>`;
    }
  }

  document.getElementById("lista-dificeis").addEventListener("click", (e) => {
    if (e.target.dataset.irInline) {
      e.preventDefault();
      limparFormulario();
      irPara("nova");
    }
  });

  // ===================== LISTA =====================

  const tabela = document.getElementById("tabela-questoes");

  async function carregarQuestoes(pagina) {
    paginaAtual = pagina;
    tabela.innerHTML = `<tr><td colspan="6" class="vazio">Carregando…</td></tr>`;

    // A lista vem do Quest Service; as estatísticas, do Answer Service.
    // Se o Answer Service cair, a lista continua aparecendo (sem os números).
    const [lista] = await Promise.allSettled([
      apiAuth(`/quests/mine?page=${pagina}&limit=10`),
      buscarEstatisticas(),
    ]);

    if (lista.status === "rejected") {
      tabela.innerHTML = `<tr><td colspan="6" class="vazio erro">${escaparHtml(lista.reason.message)}</td></tr>`;
      return;
    }

    const { data, meta } = lista.value;

    if (!data.length) {
      tabela.innerHTML = `<tr><td colspan="6" class="vazio">Nenhuma questão ainda. Clique em “+ Nova questão”.</td></tr>`;
    } else {
      tabela.innerHTML = data.map(linhaQuestao).join("");
    }
    renderizarPaginacao(document.getElementById("paginacao-questoes"), meta, carregarQuestoes);
  }

  function linhaQuestao(q) {
    const est = estatisticas.get(q.id);
    const total = est ? est.totalAnswers : q._count?.answers ?? 0;
    const acerto = est && est.totalAnswers ? est.accuracy.replace(".0", "") : "–";
    const distribuicao = est && est.totalAnswers
      ? Object.entries(est.distribution)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([letra, n]) => `${escaparHtml(letra)}: ${n}`)
          .join(" · ")
      : "";

    return `
      <tr>
        <td data-rotulo="Enunciado" class="celula-texto">
          ${escaparHtml(resumirTexto(q.statement))}
          ${distribuicao ? `<small class="distribuicao">Marcadas — ${distribuicao}</small>` : ""}
        </td>
        <td data-rotulo="Área">${escaparHtml(NOMES_AREA[q.area] || q.area || "-")}</td>
        <td data-rotulo="Gabarito"><span class="letra">${escaparHtml(q.correctOption)}</span></td>
        <td data-rotulo="Respostas">${total}</td>
        <td data-rotulo="Acerto">${acerto}</td>
        <td class="acoes">
          <button type="button" class="botao-pequeno" data-editar="${q.id}">Editar</button>
          <button type="button" class="botao-pequeno perigo" data-excluir="${q.id}">Excluir</button>
        </td>
      </tr>`;
  }

  tabela.addEventListener("click", async (e) => {
    const editar = e.target.closest("button[data-editar]");
    const excluir = e.target.closest("button[data-excluir]");

    if (editar) {
      editar.disabled = true;
      try {
        const questao = await apiAuth(`/quests/${editar.dataset.editar}`);
        preencherFormulario(questao);
        history.replaceState(null, "", "#nova");
        irPara("nova");
      } catch (erro) {
        mostrarAviso(aviso, erro.message, "erro");
      } finally {
        editar.disabled = false;
      }
    }

    if (excluir) {
      if (!confirm("Excluir esta questão? As respostas dos alunos para ela também serão apagadas.")) return;
      excluir.disabled = true;
      try {
        await apiAuth(`/quests/${excluir.dataset.excluir}`, { method: "DELETE" });
        mostrarAviso(aviso, "Questão excluída.");
        carregarQuestoes(paginaAtual);
      } catch (erro) {
        excluir.disabled = false;
        mostrarAviso(aviso, erro.message, "erro");
      }
    }
  });

  // ===================== FORMULÁRIO =====================

  const form = document.getElementById("form-questao");
  const erroForm = document.getElementById("erro-form");
  const listaAlternativas = document.getElementById("lista-alternativas");

  listaAlternativas.innerHTML = LETRAS.map(
    (letra, i) => `
    <div class="alternativa-linha">
      <label class="marcar-correta" title="Marcar ${letra} como correta">
        <input type="radio" name="correta" value="${letra}" ${i === 0 ? "checked" : ""}>
        <span>${letra}</span>
        <span class="oculto">Marcar ${letra} como correta</span>
      </label>
      <div class="campo">
        <label class="oculto" for="alt-${letra}">Texto da alternativa ${letra}</label>
        <input id="alt-${letra}" type="text" placeholder="Alternativa ${letra}${i < 2 ? "" : " (opcional)"}">
      </div>
    </div>`
  ).join("");

  function limparFormulario() {
    editandoId = null;
    form.reset();
    erroForm.hidden = true;
    document.getElementById("titulo-nova").textContent = "Nova questão";
    document.getElementById("btn-salvar").textContent = "Salvar questão";
    document.getElementById("btn-cancelar").textContent = "Limpar";
  }

  function preencherFormulario(q) {
    limparFormulario();
    editandoId = q.id;
    document.getElementById("titulo-nova").textContent = "Editar questão";
    document.getElementById("btn-salvar").textContent = "Salvar alterações";
    document.getElementById("btn-cancelar").textContent = "Cancelar edição";

    document.getElementById("enunciado").value = q.statement;
    document.getElementById("fonte").value = q.source || "";

    const area = document.getElementById("area");
    if (q.area && ![...area.options].some((o) => o.value === q.area)) {
      area.add(new Option(q.area, q.area)); // área vinda do ENEM, fora da lista padrão
    }
    area.value = q.area || "linguagens";

    (Array.isArray(q.options) ? q.options : []).slice(0, LETRAS.length).forEach((opcao, i) => {
      document.getElementById(`alt-${LETRAS[i]}`).value = typeof opcao === "string" ? opcao : opcao.text || "";
    });
    const radio = form.querySelector(`input[name="correta"][value="${q.correctOption}"]`);
    if (radio) radio.checked = true;
  }

  // Clicar em "Nova questão" no menu sai do modo edição
  document.querySelector('.menu-item[data-aba="nova"]').addEventListener("click", limparFormulario);

  document.getElementById("btn-cancelar").addEventListener("click", () => {
    const estavaEditando = editandoId !== null;
    limparFormulario();
    if (estavaEditando) irPara("questoes");
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    erroForm.hidden = true;

    const statement = document.getElementById("enunciado").value.trim();
    const marcada = form.querySelector('input[name="correta"]:checked').value;

    // Pega só as alternativas preenchidas; as letras são reatribuídas em ordem (A, B, C…)
    const preenchidas = LETRAS
      .map((letra) => ({ letra, texto: document.getElementById(`alt-${letra}`).value.trim() }))
      .filter((a) => a.texto);

    const indiceCorreta = preenchidas.findIndex((a) => a.letra === marcada);

    if (!statement) return erro("Escreva o enunciado.");
    if (preenchidas.length < 2) return erro("Preencha pelo menos duas alternativas.");
    if (indiceCorreta === -1) return erro(`A alternativa ${marcada}, marcada como correta, está vazia.`);

    const body = {
      statement,
      options: preenchidas.map((a) => a.texto),
      correctOption: LETRAS[indiceCorreta],
      area: document.getElementById("area").value,
      source: document.getElementById("fonte").value.trim(),
    };

    const botao = document.getElementById("btn-salvar");
    botao.disabled = true;
    try {
      if (editandoId) {
        await apiAuth(`/quests/${editandoId}`, { method: "PUT", body });
        mostrarAviso(aviso, "Questão atualizada!");
      } else {
        await apiAuth("/quests", { method: "POST", body });
        mostrarAviso(aviso, "Questão criada! Ela já aparece para os alunos.");
      }
      limparFormulario();
      history.replaceState(null, "", "#questoes");
      irPara("questoes");
    } catch (erroApi) {
      erro(erroApi.message);
    } finally {
      botao.disabled = false;
    }
  });

  function erro(texto) {
    erroForm.textContent = texto;
    erroForm.hidden = false;
  }

  irPara = iniciarAbas("visao", (aba) => {
    if (aba === "visao") carregarResumo();
    if (aba === "questoes") carregarQuestoes(paginaAtual);
  });
});
