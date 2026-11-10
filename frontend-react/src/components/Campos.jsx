import { useState } from "react";

// Campo com ícone à esquerda (classe .campo do CSS original)
export function Campo({ id, rotulo, icone, erro, children, ...props }) {
  return (
    <>
      <label htmlFor={id}>{rotulo}</label>
      <div className={`campo${erro ? " campo-invalido" : ""}`}>
        {icone && <img src={`/assets/${icone}`} alt="" />}
        <input id={id} aria-invalid={!!erro} aria-describedby={erro ? `${id}-erro` : undefined} {...props} />
        {children}
      </div>
      {erro && <p className="erro-campo" id={`${id}-erro`}>{erro}</p>}
    </>
  );
}

export function CampoSenha({ id, rotulo, erro, ...props }) {
  const [visivel, setVisivel] = useState(false);
  return (
    <Campo id={id} rotulo={rotulo} icone="cadeado.svg" erro={erro} type={visivel ? "text" : "password"} {...props}>
      <button
        type="button"
        className="olho-botao"
        onClick={() => setVisivel((v) => !v)}
        aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
        aria-pressed={visivel}
      >
        <img className="olho" src="/assets/olho.svg" alt="" />
      </button>
    </Campo>
  );
}

export function Mensagem({ tipo = "erro", children }) {
  if (!children) return null;
  return (
    <p className={`aviso ${tipo}`} role={tipo === "erro" ? "alert" : "status"}>
      {children}
    </p>
  );
}
