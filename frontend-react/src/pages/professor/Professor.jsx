import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { useTitulo } from "../../components/Layouts.jsx";
import { Carregando, Erro, Esqueleto } from "../../components/Estados.jsx";
import { Barras, Paginacao } from "../../components/Graficos.jsx";
import { useConfirmar } from "../../components/Modal.jsx";
import FormQuestao from "../../components/FormQuestao.jsx";
import { CabecalhoPainel } from "../admin/Admin.jsx";
import { useCarregar } from "../../lib/useCarregar.js";
import { nomeArea } from "../../lib/areas.js";
import { limparPercentual, resumirTexto } from "../../lib/format.js";

export function ProfessorLayout() {
  const { user } = useAuth();
  const admin = user.role === "ADMIN";
  return (
    <CabecalhoPainel
      selo={admin ? "Administrador" : "Professor"}
      classeSelo={admin ? "selo-admin" : "selo-professor"}
      subtitulo="Crie questões e veja como seus alunos estão indo."
    />
  );
}

// ===================== INÍCIO =====================

export function ProfessorInicio() {
  useTitulo("Professor");
  const { dados, carregando, erro, recarregar } = useCarregar(() => api("/answers/teacher/stats"));
  const valor = (fn) => (carregando ? <Esqueleto /> : erro ? "–" : fn(dados.summary));

  const dificeis = (dados?.perQuest ?? [])
    .filter((q) => q.totalAnswers > 0)
    .sort((a, b) => parseFloat(a.accuracy) - parseFloat(b.accuracy))
    .slice(0, 5);

  return (
    <section className="painel-aba">
      <h2 className="titulo-aba oculto">Início</h2>

      <section className="atalhos" aria-label="Ações rápidas">
        <Link className="atalho roxo" to="/professor/nova">
          <span className="atalho-icone"><img src="/assets/editar.svg" alt="" /></span>
          <span className="atalho-titulo">Criar nova questão</span>
          <span className="atalho-seta"><img src="/assets/seta.svg" alt="" /></span>
        </Link>
        <Link className="atalho azul" to="/professor/questoes">
          <span className="atalho-icone"><img src="/assets/livro.svg" alt="" /></span>
          <span className="atalho-titulo">Ver minhas questões</span>
          <span className="atalho-seta"><img src="/assets/seta.svg" alt="" /></span>
        </Link>
      </section>

      <section className="secao">
        <h2>Desempenho dos alunos</h2>
        <div className="estatisticas quatro">
          <div className="estatistica">
            <span className="estatistica-icone"><img src="/assets/questoes.svg" alt="" /></span>
            <p className="estatistica-nome">Questões criadas</p>
            <p className="estatistica-valor">{valor((s) => s.totalQuests)}</p>
          </div>
          <div className="estatistica">
            <span className="estatistica-icone"><img src="/assets/editar.svg" alt="" /></span>
            <p className="estatistica-nome">Respostas recebidas</p>
            <p className="estatistica-valor">{valor((s) => s.totalAnswers)}</p>
          </div>
          <div className="estatistica">
            <span className="estatistica-icone"><img src="/assets/pessoas.svg" alt="" /></span>
            <p className="estatistica-nome">Alunos alcançados</p>
            <p className="estatistica-valor">{valor((s) => s.uniqueStudents)}</p>
          </div>
          <div className="estatistica">
            <span className="estatistica-icone"><img src="/assets/alvo.svg" alt="" /></span>
            <p className="estatistica-nome">Taxa de acerto</p>
            <p className="estatistica-valor">{valor((s) => limparPercentual(s.accuracy))}</p>
          </div>
        </div>
      </section>

      <section className="secao">
        <h2>Questões com menor acerto</h2>
        <article className="cartao">
          {carregando ? (
            <ul className="barras"><li className="vazio">Carregando…</li></ul>
          ) : erro ? (
            <Erro mensagem={erro} aoTentarDeNovo={recarregar} />
          ) : !dados.perQuest.length ? (
            <ul className="barras">
              <li className="vazio">Você ainda não criou questões. <Link to="/professor/nova">Crie a primeira</Link>.</li>
            </ul>
          ) : (
            <Barras
              vazio="Suas questões ainda não foram respondidas."
              itens={dificeis.map((q) => ({
                chave: q.questId,
                rotulo: resumirTexto(q.statement, 60),
                valor: q.correct,
                total: q.totalAnswers,
                texto: `${limparPercentual(q.accuracy)} de ${q.totalAnswers}`,
              }))}
            />
          )}
        </article>
      </section>
    </section>
  );
}

// ===================== MINHAS QUESTÕES =====================

export function ProfessorQuestoes() {
  useTitulo("Minhas questões");
  const avisar = useToast();
  const confirmar = useConfirmar();
  const navigate = useNavigate();
  const [pagina, setPagina] = useState(1);
  const [estado, setEstado] = useState({ carregando: true, data: [], meta: null, erro: null, stats: new Map() });
  const [ocupado, setOcupado] = useState(null);

  const carregar = useCallback(async () => {
    setEstado((e) => ({ ...e, carregando: true, erro: null }));
    // A lista vem do Quest Service; as estatísticas, do Answer Service.
    // Se o Answer Service cair, a lista continua aparecendo (sem os números).
    const [lista, stats] = await Promise.allSettled([api(`/quests/mine?page=${pagina}&limit=10`), api("/answers/teacher/stats")]);
    if (lista.status === "rejected") {
      setEstado((e) => ({ ...e, carregando: false, data: [], erro: lista.reason.message }));
      return;
    }
    setEstado({
      carregando: false,
      erro: null,
      data: lista.value.data,
      meta: lista.value.meta,
      stats: stats.status === "fulfilled" ? new Map(stats.value.perQuest.map((q) => [q.questId, q])) : new Map(),
    });
  }, [pagina]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function excluir(q) {
    if (!(await confirmar({ titulo: "Excluir questão?", texto: "As respostas dos alunos para ela também serão apagadas.", confirmar: "Excluir", perigo: true }))) return;
    setOcupado(q.id);
    try {
      await api(`/quests/${q.id}`, { method: "DELETE" });
      avisar("Questão excluída.");
      if (estado.data.length === 1 && pagina > 1) setPagina(pagina - 1);
      else await carregar();
    } catch (e) {
      avisar(e.message, "erro");
    } finally {
      setOcupado(null);
    }
  }

  return (
    <section className="painel-aba">
      <div className="titulo-com-acao">
        <h2 className="titulo-aba">Minhas questões</h2>
        <Link className="botao-pequeno principal" to="/professor/nova">+ Nova questão</Link>
      </div>

      <div className={`tabela-wrap${estado.carregando ? " atualizando" : ""}`}>
        <table className="tabela">
          <thead>
            <tr>
              <th scope="col">Enunciado</th>
              <th scope="col">Área</th>
              <th scope="col">Gabarito</th>
              <th scope="col">Respostas</th>
              <th scope="col">Acerto</th>
              <th scope="col"><span className="oculto">Ações</span></th>
            </tr>
          </thead>
          <tbody>
            {estado.erro ? (
              <tr><td colSpan={6} className="vazio erro">{estado.erro}</td></tr>
            ) : estado.carregando && !estado.data.length ? (
              <tr><td colSpan={6} className="vazio">Carregando…</td></tr>
            ) : !estado.data.length ? (
              <tr><td colSpan={6} className="vazio">Nenhuma questão ainda. Clique em “+ Nova questão”.</td></tr>
            ) : (
              estado.data.map((q) => {
                const est = estado.stats.get(q.id);
                const total = est ? est.totalAnswers : q._count?.answers ?? 0;
                const distribuicao = est?.totalAnswers
                  ? Object.entries(est.distribution).sort(([a], [b]) => a.localeCompare(b)).map(([l, n]) => `${l}: ${n}`).join(" · ")
                  : "";
                return (
                  <tr key={q.id}>
                    <td data-rotulo="Enunciado" className="celula-texto">
                      {resumirTexto(q.statement)}
                      {distribuicao && <small className="distribuicao">Marcadas — {distribuicao}</small>}
                    </td>
                    <td data-rotulo="Área">{nomeArea(q.area)}</td>
                    <td data-rotulo="Gabarito"><span className="letra">{q.correctOption}</span></td>
                    <td data-rotulo="Respostas">{total}</td>
                    <td data-rotulo="Acerto">{est?.totalAnswers ? limparPercentual(est.accuracy) : "–"}</td>
                    <td className="acoes">
                      <button type="button" className="botao-pequeno" onClick={() => navigate(`/professor/editar/${q.id}`)} disabled={ocupado === q.id}>Editar</button>
                      <button type="button" className="botao-pequeno perigo" onClick={() => excluir(q)} disabled={ocupado === q.id}>Excluir</button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <Paginacao meta={estado.meta} aoMudar={setPagina} />
    </section>
  );
}

// ===================== NOVA / EDITAR =====================

export function ProfessorNova() {
  useTitulo("Nova questão");
  const avisar = useToast();
  const navigate = useNavigate();
  const [versao, setVersao] = useState(0); // trocar a key limpa o formulário

  return (
    <section className="painel-aba">
      <h2 className="titulo-aba">Nova questão</h2>
      <FormQuestao
        key={versao}
        textoCancelar="Limpar"
        aoCancelar={() => setVersao((v) => v + 1)}
        aoSalvar={async (body) => {
          await api("/quests", { method: "POST", body });
          avisar("Questão criada! Ela já aparece para os alunos.");
          navigate("/professor/questoes");
        }}
      />
    </section>
  );
}

export function ProfessorEditar() {
  useTitulo("Editar questão");
  const { id } = useParams();
  const avisar = useToast();
  const navigate = useNavigate();
  const { dados, carregando, erro, recarregar } = useCarregar(() => api(`/quests/${id}`), [id]);

  if (carregando) return <Carregando texto="Carregando questão…" />;
  if (erro) return <Erro mensagem={erro} aoTentarDeNovo={recarregar} />;

  return (
    <section className="painel-aba">
      <h2 className="titulo-aba">Editar questão</h2>
      <FormQuestao
        key={dados.id}
        questao={dados}
        textoSalvar="Salvar alterações"
        textoCancelar="Cancelar edição"
        aoCancelar={() => navigate("/professor/questoes")}
        aoSalvar={async (body) => {
          await api(`/quests/${id}`, { method: "PUT", body });
          avisar("Questão atualizada!");
          navigate("/professor/questoes");
        }}
      />
    </section>
  );
}
