import { useState } from "react";
import { AREAS, normalizarArea } from "../lib/areas.js";
import { LETRAS, normalizarOpcoes } from "../lib/format.js";
import TextoRico from "./TextoRico.jsx";
import { Mensagem } from "./Campos.jsx";

function estadoInicial(q) {
  const opcoes = normalizarOpcoes(q?.options);
  return {
    statement: q?.statement ?? "",
    area: normalizarArea(q?.area) || q?.area || "linguagens",
    source: q?.source ?? "Autoral",
    alternativas: LETRAS.map((_, i) => opcoes[i]?.texto ?? ""),
    temImagem: opcoes.some((o) => o.imagem),
    correta: q?.correctOption && LETRAS.includes(q.correctOption) ? q.correctOption : "A",
  };
}

// Formulário de criar/editar questão (usado pelo professor e pelo admin).
export default function FormQuestao({ questao, aoSalvar, aoCancelar, textoSalvar = "Salvar questão", textoCancelar = "Cancelar" }) {
  const [form, setForm] = useState(() => estadoInicial(questao));
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [previa, setPrevia] = useState(false);

  const areaForaDaLista = form.area && !AREAS.some((a) => a.id === form.area);
  const atualizar = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  async function enviar(e) {
    e.preventDefault();
    setErro("");

    const statement = form.statement.trim();
    // Só as alternativas preenchidas; as letras são reatribuídas em ordem (A, B, C…)
    const preenchidas = LETRAS.map((letra, i) => ({ letra, texto: form.alternativas[i].trim() })).filter((a) => a.texto);
    const indiceCorreta = preenchidas.findIndex((a) => a.letra === form.correta);

    const falha = !statement
      ? "Escreva o enunciado."
      : preenchidas.length < 2
        ? "Preencha pelo menos duas alternativas."
        : indiceCorreta === -1
          ? `A alternativa ${form.correta}, marcada como correta, está vazia.`
          : null;
    if (falha) return setErro(falha);

    setSalvando(true);
    try {
      await aoSalvar({
        statement,
        options: preenchidas.map((a) => a.texto),
        correctOption: LETRAS[indiceCorreta],
        area: form.area,
        source: form.source.trim(),
      });
    } catch (erroApi) {
      setErro(erroApi.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form className="form-painel" onSubmit={enviar} noValidate>
      <div className="rotulo-com-acao">
        <label htmlFor="enunciado">Enunciado</label>
        <button type="button" className="link-botao" onClick={() => setPrevia((p) => !p)}>
          {previa ? "Editar texto" : "Ver prévia"}
        </button>
      </div>
      {previa ? (
        <div className="previa enunciado">
          {form.statement.trim() ? <TextoRico texto={form.statement} /> : <p className="nota">Nada para mostrar ainda.</p>}
        </div>
      ) : (
        <textarea
          id="enunciado"
          className="area-texto"
          rows={6}
          placeholder="Escreva o enunciado da questão… Imagens: ![descrição](https://link-da-imagem)"
          value={form.statement}
          onChange={(e) => atualizar("statement", e.target.value)}
        />
      )}

      <div className="linha-dupla">
        <div>
          <label htmlFor="area">Área</label>
          <select id="area" className="seletor largo" value={form.area} onChange={(e) => atualizar("area", e.target.value)}>
            {AREAS.map((a) => (
              <option key={a.id} value={a.id}>{a.nomeLongo}</option>
            ))}
            {areaForaDaLista && <option value={form.area}>{form.area}</option>}
          </select>
        </div>
        <div>
          <label htmlFor="fonte">Fonte</label>
          <div className="campo">
            <img src="/assets/livro.svg" alt="" />
            <input id="fonte" type="text" placeholder="Ex.: Lista 3 – Funções" value={form.source} onChange={(e) => atualizar("source", e.target.value)} />
          </div>
        </div>
      </div>

      <fieldset className="alternativas-form">
        <legend>
          Alternativas <span className="nota">(mínimo 2; marque a correta)</span>
        </legend>
        {form.temImagem && (
          <p className="aviso erro">Esta questão tem alternativas com imagem. Ao salvar, só o texto é mantido.</p>
        )}
        {LETRAS.map((letra, i) => (
          <div className={`alternativa-linha${form.correta === letra ? " correta" : ""}`} key={letra}>
            <label className="marcar-correta" title={`Marcar ${letra} como correta`}>
              <input type="radio" name="correta" value={letra} checked={form.correta === letra} onChange={() => atualizar("correta", letra)} />
              <span>{letra}</span>
              <span className="oculto">Marcar {letra} como correta</span>
            </label>
            <div className="campo">
              <label className="oculto" htmlFor={`alt-${letra}`}>Texto da alternativa {letra}</label>
              <input
                id={`alt-${letra}`}
                type="text"
                placeholder={`Alternativa ${letra}${i < 2 ? "" : " (opcional)"}`}
                value={form.alternativas[i]}
                onChange={(e) => {
                  const alternativas = [...form.alternativas];
                  alternativas[i] = e.target.value;
                  atualizar("alternativas", alternativas);
                }}
              />
            </div>
          </div>
        ))}
      </fieldset>

      <Mensagem>{erro}</Mensagem>

      <div className="navegacao">
        <button type="button" className="botao-secundario" onClick={aoCancelar} disabled={salvando}>
          {textoCancelar}
        </button>
        <button type="submit" className="botao-principal" disabled={salvando}>
          {salvando ? "Salvando…" : textoSalvar}
        </button>
      </div>
    </form>
  );
}
