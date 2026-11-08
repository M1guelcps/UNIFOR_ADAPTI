import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { useConfirmar } from "../../components/Modal.jsx";
import { useTitulo } from "../../components/Layouts.jsx";
import { Carregando, Erro, Vazio } from "../../components/Estados.jsx";
import TextoRico from "../../components/TextoRico.jsx";
import { nomeArea } from "../../lib/areas.js";
import { formatarDuracao, formatarTempo, normalizarOpcoes, percentual } from "../../lib/format.js";
import { lerConfig, salvarPratica } from "../../lib/praticas.js";
import { sortearQuestoes as buscarQuestoes } from "../../lib/questoes.js";

// ------------------------------------------------------------------

function useCronometro(ativo) {
  const [segundos, setSegundos] = useState(0);
  useEffect(() => {
    if (!ativo) return;
    const t = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [ativo]);
  return segundos;
}

function Alternativas({ questao, resposta, bloqueada, mostrarGabarito, aoEscolher }) {
  const opcoes = normalizarOpcoes(questao.options);
  return (
    <fieldset>
      <legend>Selecione a alternativa correta:</legend>
      {opcoes.map((op, i) => {
        const escolhida = resposta?.selecionada === op.letra;
        let estado = "";
        if (mostrarGabarito && resposta?.gabarito) {
          if (op.letra === resposta.gabarito) estado = " certa";
          else if (escolhida) estado = " errada";
        }
        return (
          <label className={`alternativa${estado}${bloqueada ? " bloqueada" : ""}`} key={op.letra}>
            <input
              type="radio"
              name={`resposta-${questao.id}`}
              value={op.letra}
              checked={escolhida}
              disabled={bloqueada}
              onChange={() => aoEscolher(op.letra)}
            />
            <span>
              <b>{op.letra}</b>
              <span className="alternativa-texto">
                {op.texto}
                {op.imagem && /^https?:\/\//.test(op.imagem) && (
                  <img className="alternativa-imagem" src={op.imagem} alt={`Alternativa ${op.letra}`} loading="lazy" />
                )}
                {!op.texto && !op.imagem && <em>(sem texto)</em>}
              </span>
              <kbd className="atalho-tecla" aria-hidden="true">{i + 1}</kbd>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

function Resultado({ questoes, respostas, segundos, config, aoRevisar }) {
  const respondidas = questoes.filter((q) => respostas[q.id]?.acertou !== undefined);
  const acertos = respondidas.filter((q) => respostas[q.id].acertou).length;
  const emBranco = questoes.length - respondidas.length;
  const pct = percentual(acertos, questoes.length);

  return (
    <section className="resultado-pratica">
      <header className="saudacao centro">
        <h1>{pct >= 70 ? "Mandou bem! 🎉" : pct >= 40 ? "Bom trabalho! 💪" : "Continue praticando! 📚"}</h1>
        <p className="subtitulo">
          {config.modo === "simulado" ? "Simulado entregue" : "Prática concluída"} ·{" "}
          {config.area === "todas" ? "Todas as áreas" : nomeArea(config.area)}
        </p>
      </header>

      <section className="placar-bloco" aria-label="Resultado da prática">
        <div className="placar">
          <span className="atalho-icone"><img src="/assets/questoes.svg" alt="" /></span>
          <div>
            <p className="placar-nota">{acertos}/{questoes.length}</p>
            <p className="placar-texto"><strong>{pct}%</strong> de aproveitamento</p>
          </div>
        </div>
        <div className="contagens">
          <div className="contagem">
            <span className="contagem-icone verde"><img src="/assets/certo.svg" alt="" /></span>
            <p>Corretas <strong>{acertos}</strong></p>
          </div>
          <div className="contagem">
            <span className="contagem-icone vermelho"><img src="/assets/errado.svg" alt="" /></span>
            <p>{emBranco ? "Incorretas / em branco" : "Incorretas"} <strong>{respondidas.length - acertos}{emBranco ? ` / ${emBranco}` : ""}</strong></p>
          </div>
          <div className="contagem">
            <span className="contagem-icone azul-claro"><img src="/assets/tempo.svg" alt="" /></span>
            <p>Tempo <strong>{formatarDuracao(segundos)}</strong></p>
          </div>
        </div>
      </section>

      <section className="cartao revisao">
        <h2>Revise suas respostas</h2>
        <ol className="revisao-lista">
          {questoes.map((q, i) => {
            const r = respostas[q.id];
            const status = r?.acertou === undefined ? "branco" : r.acertou ? "certa" : "errada";
            return (
              <li key={q.id}>
                <button type="button" className={`revisao-item ${status}`} onClick={() => aoRevisar(i)}>
                  <span className="revisao-numero">{i + 1}</span>
                  <span className="revisao-texto">
                    {nomeArea(q.area)} · {status === "branco" ? "Em branco" : `Você marcou ${r.selecionada}`}
                    {status === "errada" && ` · Correta: ${r.gabarito}`}
                  </span>
                  <span className="revisao-status">{status === "certa" ? "✓" : status === "errada" ? "✗" : "–"}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="navegacao acoes-resultado">
        <Link className="botao-principal botao-link" to="/praticar">Nova prática</Link>
        <Link className="botao-secundario botao-link" to="/desempenho">Ver desempenho geral</Link>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------

export default function Pratica() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const avisar = useToast();
  const confirmar = useConfirmar();
  const config = useMemo(() => location.state?.config ?? lerConfig(), [location.state]);
  const simulado = config.modo === "simulado";

  const [questoes, setQuestoes] = useState(null);
  const [erro, setErro] = useState(null);
  const [indice, setIndice] = useState(0);
  // respostas[questId] = { selecionada, gabarito?, acertou?, enviando? }
  const [respostas, setRespostas] = useState({});
  const [finalizada, setFinalizada] = useState(false);
  const [entregando, setEntregando] = useState(false);
  const salvou = useRef(false);

  const carregar = useCallback(async () => {
    setErro(null);
    setQuestoes(null);
    try {
      const lista = await buscarQuestoes(config);
      setQuestoes(lista);
      if (lista.length && lista.length < config.limit) {
        avisar(`Só encontramos ${lista.length} questão(ões) com esses filtros.`, "info");
      }
    } catch (e) {
      setErro(e.message);
    }
  }, [config, avisar]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const emAndamento = !!questoes?.length && !finalizada;
  const segundos = useCronometro(emAndamento);
  useTitulo(questoes?.length && !finalizada ? `Questão ${indice + 1} de ${questoes.length}` : finalizada ? "Resultado" : "Prática");

  // Aviso ao fechar a aba no meio da prática
  useEffect(() => {
    if (!emAndamento || !Object.keys(respostas).length) return;
    const aviso = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [emAndamento, respostas]);

  const questao = questoes?.[indice];
  const resposta = questao ? respostas[questao.id] : undefined;
  const corrigida = resposta?.acertou !== undefined;
  const ultima = questoes && indice === questoes.length - 1;

  const escolher = useCallback(
    (letra) => {
      if (!questao || corrigida || finalizada) return;
      setRespostas((r) => ({ ...r, [questao.id]: { ...r[questao.id], selecionada: letra } }));
    },
    [questao, corrigida, finalizada]
  );

  async function enviarResposta(q, letra) {
    const r = await api("/answers", { method: "POST", body: { questId: q.id, selectedOption: letra } });
    // O backend só devolve o gabarito quando a resposta está errada
    return { selecionada: letra, acertou: r.isCorrect, gabarito: r.isCorrect ? letra : r.correctOption };
  }

  async function responder() {
    if (!questao || corrigida || resposta?.enviando) return;
    if (!resposta?.selecionada) return avisar("Selecione uma alternativa.", "info");

    setRespostas((r) => ({ ...r, [questao.id]: { ...r[questao.id], enviando: true } }));
    try {
      const resultado = await enviarResposta(questao, resposta.selecionada);
      setRespostas((r) => ({ ...r, [questao.id]: resultado }));
    } catch (e) {
      setRespostas((r) => ({ ...r, [questao.id]: { selecionada: resposta.selecionada } }));
      avisar(`Não foi possível enviar a resposta: ${e.message}`, "erro");
    }
  }

  function concluir(respostasFinais) {
    if (salvou.current) return;
    salvou.current = true;
    const acertos = questoes.filter((q) => respostasFinais[q.id]?.acertou).length;
    salvarPratica(user.id, {
      id: Date.now(),
      data: new Date().toISOString(),
      modo: config.modo,
      area: config.area,
      ano: config.ano,
      total: questoes.length,
      acertos,
      percentual: percentual(acertos, questoes.length),
      segundos,
    });
    setFinalizada(true);
    setIndice(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function finalizar() {
    if (!simulado) {
      const faltam = questoes.filter((q) => respostas[q.id]?.acertou === undefined).length;
      if (faltam && !(await confirmar({ titulo: "Finalizar prática?", texto: `Ainda há ${faltam} questão(ões) sem resposta. Elas contam como em branco.`, confirmar: "Finalizar" }))) return;
      return concluir(respostas);
    }

    // Simulado: as respostas só vão para o backend na entrega
    const marcadas = questoes.filter((q) => respostas[q.id]?.selecionada);
    const faltam = questoes.length - marcadas.length;
    const ok = await confirmar({
      titulo: "Entregar simulado?",
      texto: faltam ? `Você deixou ${faltam} questão(ões) em branco. Depois de entregar não dá para mudar as respostas.` : "Depois de entregar não dá para mudar as respostas.",
      confirmar: "Entregar",
    });
    if (!ok) return;

    setEntregando(true);
    const resultados = await Promise.allSettled(marcadas.map((q) => enviarResposta(q, respostas[q.id].selecionada)));
    const finais = { ...respostas };
    let falhas = 0;
    resultados.forEach((res, i) => {
      const q = marcadas[i];
      if (res.status === "fulfilled") finais[q.id] = res.value;
      else falhas++;
    });
    setEntregando(false);
    setRespostas(finais);

    if (falhas) {
      avisar(`${falhas} resposta(s) não foram enviadas. Tente entregar de novo.`, "erro");
      return;
    }
    concluir(finais);
  }

  function irPara(i) {
    if (!questoes) return;
    setIndice(Math.min(Math.max(i, 0), questoes.length - 1));
  }

  // Atalhos de teclado: 1–5 ou A–E escolhem, Enter responde/avança, setas navegam
  useEffect(() => {
    function tecla(e) {
      if (!questao || entregando || e.target.closest?.("input[type=text], textarea, dialog[open]")) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const opcoes = normalizarOpcoes(questao.options);
      const k = e.key.toUpperCase();
      const porNumero = /^[1-5]$/.test(k) ? opcoes[Number(k) - 1] : null;
      const porLetra = opcoes.find((o) => o.letra === k);
      if ((porNumero || porLetra) && !finalizada) {
        e.preventDefault();
        escolher((porNumero || porLetra).letra);
      } else if (e.key === "ArrowRight") irPara(indice + 1);
      else if (e.key === "ArrowLeft") irPara(indice - 1);
      else if (e.key === "Enter" && !finalizada) {
        e.preventDefault();
        if (!simulado && !corrigida) responder();
        else if (!ultima) irPara(indice + 1);
        else finalizar();
      }
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  });

  // ------------------------------------------------------------------

  if (erro) return <Erro mensagem={`Erro ao buscar questões: ${erro}`} aoTentarDeNovo={carregar} />;
  if (!questoes) return <Carregando texto="Preparando sua prática…" />;
  if (!questoes.length) {
    return (
      <Vazio>
        <h2>Nenhuma questão encontrada com esses filtros.</h2>
        <p>Tente outra área ou o ano "Todos". Se o banco estiver vazio, peça a um administrador para importar questões do ENEM.</p>
        <Link className="botao-pequeno principal" to="/praticar">Mudar filtros</Link>
      </Vazio>
    );
  }

  const mostrarGabarito = finalizada || (!simulado && corrigida);
  const respondidas = questoes.filter((q) => (simulado && !finalizada ? respostas[q.id]?.selecionada : respostas[q.id]?.acertou !== undefined)).length;

  return (
    <>
      {finalizada && (
        <Resultado questoes={questoes} respostas={respostas} segundos={segundos} config={config} aoRevisar={(i) => {
          setIndice(i);
          document.getElementById("area-questao")?.scrollIntoView({ behavior: "smooth" });
        }} />
      )}

      <article className="questao" id="area-questao">
        <header className="questao-topo">
          <div className="questao-titulo">
            <h1>{finalizada ? "Revisão · " : ""}Questão {indice + 1} de {questoes.length}</h1>
            <div className="questao-info">
              {simulado && <span className="selo">Simulado</span>}
              {config.cronometro && (
                <span className="relogio" aria-label="Tempo decorrido">⏱ {formatarTempo(segundos)}</span>
              )}
            </div>
          </div>
          <div className="progresso" role="progressbar" aria-valuemin={0} aria-valuemax={questoes.length} aria-valuenow={respondidas} aria-label="Questões respondidas">
            <span style={{ width: `${(respondidas / questoes.length) * 100}%` }} />
          </div>
          <nav className="mapa-questoes" aria-label="Ir para a questão">
            {questoes.map((q, i) => {
              const r = respostas[q.id];
              const corrigidaAqui = r?.acertou !== undefined && (finalizada || !simulado);
              const classe = corrigidaAqui ? (r.acertou ? "certa" : "errada") : r?.selecionada ? "marcada" : "";
              return (
                <button key={q.id} type="button" className={`mapa-item ${classe}${i === indice ? " atual" : ""}`} onClick={() => irPara(i)} aria-current={i === indice ? "step" : undefined} aria-label={`Questão ${i + 1}`}>
                  {i + 1}
                </button>
              );
            })}
          </nav>
        </header>

        <div className="questao-corpo">
          <div className="enunciado">
            <p className="etiqueta">
              <span className="estatistica-icone"><img src="/assets/desempenho.svg" alt="" /></span>
              {nomeArea(questao.area).toUpperCase()}{questao.source ? ` · ${questao.source}` : ""}
            </p>
            <TextoRico texto={questao.statement} />
          </div>

          <form className="respostas" onSubmit={(e) => { e.preventDefault(); responder(); }}>
            <Alternativas
              questao={questao}
              resposta={resposta}
              bloqueada={finalizada || corrigida || resposta?.enviando || entregando}
              mostrarGabarito={mostrarGabarito}
              aoEscolher={escolher}
            />

            {mostrarGabarito && resposta?.acertou !== undefined && (
              <p className={`feedback ${resposta.acertou ? "certa" : "errada"}`} role="status">
                {resposta.acertou ? "✓ Resposta correta!" : `✗ Resposta incorreta. A correta é a ${resposta.gabarito}.`}
              </p>
            )}
            {finalizada && resposta?.acertou === undefined && <p className="feedback branco">Você deixou esta questão em branco.</p>}

            <div className="navegacao">
              <button type="button" className="botao-secundario" onClick={() => irPara(indice - 1)} disabled={indice === 0} style={{ visibility: indice === 0 ? "hidden" : "visible" }}>
                Anterior
              </button>

              {finalizada ? (
                ultima ? (
                  <button type="button" className="botao-principal" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>Ver resultado</button>
                ) : (
                  <button type="button" className="botao-principal" onClick={() => irPara(indice + 1)}>Próxima</button>
                )
              ) : !simulado && !corrigida ? (
                <button type="submit" className="botao-principal" disabled={!resposta?.selecionada || resposta?.enviando}>
                  {resposta?.enviando ? "Validando…" : "Responder"}
                </button>
              ) : ultima ? (
                <button type="button" className="botao-principal" onClick={finalizar} disabled={entregando}>
                  {entregando ? "Entregando…" : simulado ? "Entregar simulado" : "Finalizar prática"}
                </button>
              ) : (
                <button type="button" className="botao-principal" onClick={() => irPara(indice + 1)}>Próxima</button>
              )}
            </div>

            {!finalizada && (
              <p className="nota dica-teclado">
                Atalhos: <kbd>1</kbd>–<kbd>5</kbd> escolhem, <kbd>Enter</kbd> {simulado ? "avança" : "responde/avança"}, <kbd>←</kbd> <kbd>→</kbd> navegam.
                {simulado && !ultima && (
                  <>
                    {" "}
                    <button type="button" className="link-botao" onClick={finalizar} disabled={entregando}>Entregar agora</button>
                  </>
                )}
              </p>
            )}
          </form>
        </div>
      </article>

      {!finalizada && (
        <p className="sair-pratica">
          <button
            type="button"
            className="link-botao"
            onClick={async () => {
              if (!Object.keys(respostas).length || (await confirmar({ titulo: "Sair da prática?", texto: "O resumo desta prática não será salvo.", confirmar: "Sair", perigo: true }))) {
                navigate("/inicio");
              }
            }}
          >
            Sair da prática
          </button>
        </p>
      )}
    </>
  );
}
