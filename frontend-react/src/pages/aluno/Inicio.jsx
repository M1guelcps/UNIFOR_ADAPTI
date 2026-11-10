import { Link } from "react-router-dom";
import { api } from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useTitulo } from "../../components/Layouts.jsx";
import { Esqueleto } from "../../components/Estados.jsx";
import { useCarregar } from "../../lib/useCarregar.js";
import { listarPraticas } from "../../lib/praticas.js";
import { formatarDataHora, limparPercentual, primeiroNome, resumirTexto } from "../../lib/format.js";
import { nomeArea } from "../../lib/areas.js";

function UltimoResultado({ pratica, ultimaResposta }) {
  if (pratica) {
    const titulo = pratica.modo === "simulado" ? "Simulado ENEM" : "Prática de questões";
    const area = pratica.area === "todas" ? "Todas as áreas" : nomeArea(pratica.area);
    return (
      <Link className="resultado" to="/desempenho">
        <span className="atalho-icone"><img src={`/assets/${pratica.modo === "simulado" ? "simulado" : "questoes"}.svg`} alt="" /></span>
        <span className="resultado-texto">
          <span className="atalho-titulo">{titulo} · {area}</span>
          <span className="resultado-detalhe">
            {pratica.acertos} de {pratica.total} acertos · {pratica.percentual}% · {formatarDataHora(pratica.data)}
          </span>
        </span>
        <span className="atalho-seta"><img src="/assets/seta.svg" alt="" /></span>
      </Link>
    );
  }

  if (ultimaResposta) {
    return (
      <Link className="resultado" to="/desempenho">
        <span className="atalho-icone"><img src="/assets/questoes.svg" alt="" /></span>
        <span className="resultado-texto">
          <span className="atalho-titulo">{ultimaResposta.isCorrect ? "Você acertou a última questão! 🎉" : "Você errou a última questão. Vamos revisar? 💪"}</span>
          <span className="resultado-detalhe">{resumirTexto(ultimaResposta.quest?.statement, 80)}</span>
        </span>
        <span className="atalho-seta"><img src="/assets/seta.svg" alt="" /></span>
      </Link>
    );
  }

  return (
    <Link className="resultado" to="/praticar">
      <span className="atalho-icone"><img src="/assets/questoes.svg" alt="" /></span>
      <span className="resultado-texto">
        <span className="atalho-titulo">Nenhuma prática ainda</span>
        <span className="resultado-detalhe">Resolva sua primeira questão para ver o resultado aqui.</span>
      </span>
      <span className="atalho-seta"><img src="/assets/seta.svg" alt="" /></span>
    </Link>
  );
}

export default function Inicio() {
  useTitulo("Início");
  const { user } = useAuth();
  const { dados, carregando, erro } = useCarregar(() => api("/answers/me"));
  const praticas = listarPraticas(user.id);
  const simulados = praticas.filter((p) => p.modo === "simulado").length;

  const valor = (conteudo) => (carregando ? <Esqueleto /> : erro ? "–" : conteudo);

  return (
    <>
      <section className="hero" aria-label="Começar a estudar">
        <div>
          <h1>Olá, {primeiroNome(user.name)} 👋</h1>
          <p>Pronto para praticar hoje? Escolha como quer estudar.</p>
        </div>
        <div className="hero-acoes">
          <Link className="botao-principal" to="/praticar?modo=questoes">
            <img src="/assets/editar.svg" alt="" />
            Resolver questões
          </Link>
          <Link className="botao-secundario" to="/praticar?modo=simulado">
            <img src="/assets/simulado.svg" alt="" />
            Fazer simulado
          </Link>
        </div>
      </section>

      <section className="secao">
        <h2>Seu desempenho</h2>
        {erro && <p className="aviso erro">Não foi possível carregar suas métricas: {erro}</p>}
        <div className="estatisticas">
          <div className="estatistica">
            <span className="estatistica-icone"><img src="/assets/questoes.svg" alt="" /></span>
            <p className="estatistica-nome">Questões respondidas</p>
            <p className="estatistica-valor">{valor(dados?.metrics.totalAnswers)}</p>
          </div>
          <div className="estatistica">
            <span className="estatistica-icone"><img src="/assets/editar.svg" alt="" /></span>
            <p className="estatistica-nome">Taxa de acerto</p>
            <p className="estatistica-valor">{valor(limparPercentual(dados?.metrics.accuracy))}</p>
          </div>
          <div className="estatistica">
            <span className="estatistica-icone"><img src="/assets/desempenho.svg" alt="" /></span>
            <p className="estatistica-nome">Simulados</p>
            <p className="estatistica-valor">{simulados}</p>
          </div>
        </div>
      </section>

      <section className="secao">
        <h2>Último resultado</h2>
        <UltimoResultado pratica={praticas[0]} ultimaResposta={dados?.history?.[0]} />
      </section>
    </>
  );
}
