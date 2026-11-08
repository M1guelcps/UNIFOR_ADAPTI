import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTitulo } from "../../components/Layouts.jsx";
import { Esqueleto } from "../../components/Estados.jsx";
import { AREAS, anoDaFonte, nomeArea } from "../../lib/areas.js";
import { lerConfig, salvarConfig } from "../../lib/praticas.js";
import { carregarBanco, contar } from "../../lib/questoes.js";

const ANOS_PADRAO = ["2023", "2022", "2021"];
const QUANTIDADES = [5, 10, 20, 45];

function Opcao({ name, value, atual, aoMudar, classe = "", desativada, children }) {
  return (
    <label className={`opcao ${classe}${desativada ? " desativada" : ""}`}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={String(atual) === String(value)}
        disabled={desativada}
        onChange={() => aoMudar(value)}
      />
      <span>{children}</span>
    </label>
  );
}

function Contagem({ n }) {
  if (n === undefined) return null;
  return <small className="contagem-opcao" aria-label={`${n} questões`}>{n}</small>;
}

export default function ConfigurarPratica() {
  useTitulo("Configurar prática");
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [config, setConfig] = useState(() => {
    const salva = lerConfig();
    const modo = params.get("modo");
    return modo === "simulado" || modo === "questoes" ? { ...salva, modo } : salva;
  });
  const [banco, setBanco] = useState(null);
  const [erroBanco, setErroBanco] = useState(false);

  useEffect(() => {
    carregarBanco()
      .then(setBanco)
      .catch(() => setErroBanco(true));
  }, []);

  const mudar = (campo) => (valor) => setConfig((c) => ({ ...c, [campo]: valor }));

  // Anos que existem no banco (mais recentes primeiro)
  const anos = useMemo(() => {
    if (!banco) return ANOS_PADRAO;
    const encontrados = [...new Set(banco.map((q) => anoDaFonte(q.source)).filter(Boolean))].sort().reverse();
    return encontrados.length ? encontrados.slice(0, 6) : ANOS_PADRAO;
  }, [banco]);

  const contagem = (filtros) => (banco ? contar(banco, { ...config, ...filtros }) : undefined);
  const disponiveis = contagem({});
  const total = disponiveis === undefined ? config.limit : Math.min(config.limit, disponiveis);
  const semQuestoes = disponiveis === 0;

  function comecar(e) {
    e.preventDefault();
    if (semQuestoes) return;
    salvarConfig(config);
    navigate("/praticar/sessao", { state: { config } });
  }

  const nomeAno = config.ano === "todos" ? "Todos os anos" : `ENEM ${config.ano}`;
  const nomeAreaSel = config.area === "todas" ? "Todas as áreas" : nomeArea(config.area);

  return (
    <>
      <header className="saudacao">
        <h1>Configurar prática</h1>
        <p className="subtitulo">Escolha o que estudar hoje. Você pode mudar quando quiser.</p>
      </header>

      <form className="config-grade" onSubmit={comecar}>
        <div className="configuracao">
          <fieldset>
            <legend>Modo</legend>
            <div className="opcoes duas">
              <Opcao name="modo" value="questoes" atual={config.modo} aoMudar={mudar("modo")} classe="opcao-modo">
                <img src="/assets/questoes.svg" alt="" />
                <span>
                  <strong>Questões</strong>
                  <small>Correção logo após cada resposta</small>
                </span>
              </Opcao>
              <Opcao name="modo" value="simulado" atual={config.modo} aoMudar={mudar("modo")} classe="opcao-modo">
                <img src="/assets/simulado.svg" alt="" />
                <span>
                  <strong>Simulado</strong>
                  <small>Gabarito só na entrega, como na prova</small>
                </span>
              </Opcao>
            </div>
          </fieldset>

          <fieldset>
            <legend>Área</legend>
            <div className="opcoes cinco">
              <Opcao name="area" value="todas" atual={config.area} aoMudar={mudar("area")} classe="area">
                <img src="/assets/alvo.svg" alt="" />
                Todas
                <Contagem n={contagem({ area: "todas" })} />
              </Opcao>
              {AREAS.map((a) => {
                const n = contagem({ area: a.id });
                return (
                  <Opcao key={a.id} name="area" value={a.id} atual={config.area} aoMudar={mudar("area")} classe="area" desativada={n === 0 && config.area !== a.id}>
                    <img src={`/assets/${a.icone}`} alt="" />
                    {a.nome}
                    <Contagem n={n} />
                  </Opcao>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend>Ano do ENEM</legend>
            <div className="opcoes quatro">
              {[...anos, "todos"].map((ano) => {
                const n = contagem({ ano });
                return (
                  <Opcao key={ano} name="ano" value={ano} atual={config.ano} aoMudar={mudar("ano")} desativada={n === 0 && config.ano !== ano}>
                    {ano === "todos" ? "Todos" : ano}
                    <Contagem n={n} />
                  </Opcao>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend>Quantidade de questões</legend>
            <div className="opcoes quatro">
              {QUANTIDADES.map((n) => (
                <Opcao key={n} name="quantidade" value={n} atual={config.limit} aoMudar={(v) => mudar("limit")(Number(v))}>
                  {n}
                </Opcao>
              ))}
            </div>
          </fieldset>

          <label className="cronometro">
            <img src="/assets/relogio.svg" alt="" />
            <span>
              Mostrar cronômetro
              <small>O tempo fica salvo no seu desempenho</small>
            </span>
            <input className="chave" type="checkbox" checked={config.cronometro} onChange={(e) => mudar("cronometro")(e.target.checked)} />
          </label>
        </div>

        <aside className="cartao resumo-config" aria-live="polite">
          <h2>Sua prática</h2>
          <dl className="resumo-linhas">
            <div><dt>Modo</dt><dd>{config.modo === "simulado" ? "Simulado" : "Questões"}</dd></div>
            <div><dt>Área</dt><dd>{nomeAreaSel}</dd></div>
            <div><dt>Prova</dt><dd>{nomeAno}</dd></div>
            <div><dt>Cronômetro</dt><dd>{config.cronometro ? "Ligado" : "Desligado"}</dd></div>
          </dl>

          <div className="disponiveis">
            <strong>{disponiveis === undefined && !erroBanco ? <Esqueleto largura="2ch" /> : total}</strong>
            <span>questão(ões) nesta prática</span>
          </div>

          {semQuestoes && (
            <p className="aviso erro">Não há questões com esses filtros. Escolha outra área ou o ano “Todos”.</p>
          )}
          {!semQuestoes && disponiveis !== undefined && disponiveis < config.limit && (
            <p className="aviso info">Existem só {disponiveis} questão(ões) com esses filtros.</p>
          )}
          {erroBanco && <p className="aviso erro">Não foi possível consultar o banco de questões.</p>}

          <button type="submit" className="botao-principal" disabled={semQuestoes}>
            {config.modo === "simulado" ? "Começar simulado" : "Começar agora"}
          </button>
        </aside>
      </form>
    </>
  );
}
