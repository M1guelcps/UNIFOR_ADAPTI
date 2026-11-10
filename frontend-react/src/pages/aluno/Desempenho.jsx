import { Link } from "react-router-dom";
import { api } from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useTitulo } from "../../components/Layouts.jsx";
import { Carregando, Erro, Vazio } from "../../components/Estados.jsx";
import { useCarregar } from "../../lib/useCarregar.js";
import { AREAS, nomeArea, normalizarArea } from "../../lib/areas.js";
import { listarPraticas } from "../../lib/praticas.js";
import { formatarDataHora, formatarDuracao, limparPercentual, percentual, resumirTexto } from "../../lib/format.js";

function porArea(history) {
  const stats = Object.fromEntries(AREAS.map((a) => [a.id, { total: 0, corretas: 0 }]));
  history.forEach((item) => {
    const id = normalizarArea(item.quest?.area);
    if (!id) return;
    stats[id].total++;
    if (item.isCorrect) stats[id].corretas++;
  });
  return AREAS.map((a) => ({ ...a, ...stats[a.id], pct: percentual(stats[a.id].corretas, stats[a.id].total) }));
}

export default function Desempenho() {
  useTitulo("Seu desempenho");
  const { user } = useAuth();
  const { dados, carregando, erro, recarregar } = useCarregar(() => api("/answers/me"));
  const praticas = listarPraticas(user.id);
  const tempoTotal = praticas.reduce((s, p) => s + (p.segundos || 0), 0);

  if (carregando && !dados) return <Carregando texto="Carregando suas métricas…" />;
  if (erro) return <Erro mensagem={`Erro ao carregar os dados: ${erro}`} aoTentarDeNovo={recarregar} />;

  const { metrics, history } = dados;
  const areas = porArea(history);
  const respondidas = areas.filter((a) => a.total > 0).sort((a, b) => b.pct - a.pct);
  const melhor = respondidas[0];
  const pior = respondidas.length > 1 ? respondidas[respondidas.length - 1] : null;

  return (
    <>
      <header className="saudacao centro">
        <h1>Seu desempenho</h1>
        <p className="subtitulo">Veja como você está indo em cada área</p>
      </header>

      {metrics.totalAnswers === 0 ? (
        <Vazio>
          <h2>Você ainda não respondeu nenhuma questão.</h2>
          <p>Seu desempenho aparece aqui assim que você começar a praticar.</p>
          <Link className="botao-pequeno principal" to="/praticar">Começar a praticar</Link>
        </Vazio>
      ) : (
        <div className="resultado-grade">
          <section className="placar-bloco" aria-label="Resultado geral">
            <div className="placar">
              <span className="atalho-icone"><img src="/assets/questoes.svg" alt="" /></span>
              <div>
                <p className="placar-nota">{metrics.correct}/{metrics.totalAnswers}</p>
                <p className="placar-texto"><strong>{limparPercentual(metrics.accuracy)}</strong> de aproveitamento</p>
              </div>
            </div>
            <div className="contagens">
              <div className="contagem">
                <span className="contagem-icone verde"><img src="/assets/certo.svg" alt="" /></span>
                <p>Corretas <strong>{metrics.correct}</strong></p>
              </div>
              <div className="contagem">
                <span className="contagem-icone vermelho"><img src="/assets/errado.svg" alt="" /></span>
                <p>Incorretas <strong>{metrics.wrong}</strong></p>
              </div>
              <div className="contagem">
                <span className="contagem-icone azul-claro"><img src="/assets/tempo.svg" alt="" /></span>
                <p>Tempo praticando <strong>{praticas.length ? formatarDuracao(tempoTotal) : "–"}</strong></p>
              </div>
            </div>
          </section>

          <section className="cartao-area">
            <h2>Desempenho por área</h2>
            <ul className="areas">
              {areas.map((a) => (
                <li className={`area-linha ${a.id}`} key={a.id}>
                  <span className="area-icone"><img src={`/assets/${a.icone}`} alt="" /></span>
                  <span className="area-nome">{a.nome}</span>
                  <span className="barra-fundo"><span className="barra-cheia" style={{ width: `${a.pct}%` }} /></span>
                  <span className="area-valor" title={`${a.corretas} de ${a.total}`}>{a.total ? `${a.pct}%` : "–"}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="cartao-resumo">
            <h2>Resumo</h2>
            <div className="resumo-item">
              <span className="contagem-icone verde"><img src="/assets/trofeu.svg" alt="" /></span>
              <div>
                <p className="resumo-titulo">Melhor área: <span className="destaque-roxo">{melhor?.nome ?? "-"}</span></p>
                <p className="resumo-detalhe">{melhor ? `${melhor.pct}% de aproveitamento em ${melhor.total} questão(ões)` : "Sem dados suficientes"}</p>
              </div>
            </div>
            <div className="resumo-item">
              <span className="contagem-icone vermelho"><img src="/assets/alvo.svg" alt="" /></span>
              <div>
                <p className="resumo-titulo">Revisar: <span className="destaque-vermelho">{pior?.nome ?? "-"}</span></p>
                <p className="resumo-detalhe">{pior ? `${pior.pct}% de aproveitamento em ${pior.total} questão(ões)` : "Pratique mais de uma área para comparar"}</p>
              </div>
            </div>
          </section>
        </div>
      )}

      {praticas.length > 0 && (
        <section className="secao">
          <h2>Últimas práticas</h2>
          <ul className="lista-historico">
            {praticas.slice(0, 5).map((p) => (
              <li key={p.id}>
                <span className={`selo${p.modo === "simulado" ? " selo-admin" : ""}`}>{p.modo === "simulado" ? "Simulado" : "Questões"}</span>
                <span className="historico-texto">
                  {p.area === "todas" ? "Todas as áreas" : nomeArea(p.area)} · {formatarDataHora(p.data)}
                </span>
                <strong>{p.acertos}/{p.total} · {p.percentual}%</strong>
                <span className="nota">{formatarDuracao(p.segundos)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {history.length > 0 && (
        <section className="secao">
          <h2>Respostas recentes</h2>
          <ul className="lista-historico">
            {history.slice(0, 8).map((h) => (
              <li key={h.id}>
                <span className={`marcador ${h.isCorrect ? "certa" : "errada"}`} aria-label={h.isCorrect ? "Acertou" : "Errou"}>{h.isCorrect ? "✓" : "✗"}</span>
                <span className="historico-texto">{resumirTexto(h.quest?.statement, 90)}</span>
                <span className="nota">{nomeArea(h.quest?.area)} · {formatarDataHora(h.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="navegacao acoes-resultado">
        <Link className="botao-principal botao-link" to="/praticar?modo=questoes">Praticar questões</Link>
        <Link className="botao-secundario botao-link" to="/praticar?modo=simulado">Novo simulado</Link>
      </div>
    </>
  );
}
