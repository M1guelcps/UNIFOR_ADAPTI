// Estados de carregamento, erro e vazio usados em todas as telas.
export function Carregando({ texto = "Carregando…" }) {
  return (
    <div className="estado" role="status">
      <span className="spinner" aria-hidden="true" />
      <p>{texto}</p>
    </div>
  );
}

export function Erro({ mensagem, aoTentarDeNovo }) {
  return (
    <div className="estado estado-erro" role="alert">
      <p>{mensagem || "Algo deu errado."}</p>
      {aoTentarDeNovo && (
        <button type="button" className="botao-pequeno principal" onClick={aoTentarDeNovo}>
          Tentar de novo
        </button>
      )}
    </div>
  );
}

export function Vazio({ children }) {
  return <div className="estado estado-vazio">{children}</div>;
}

// Bloco cinza no lugar do número enquanto carrega
export function Esqueleto({ largura = "3ch" }) {
  return <span className="esqueleto" style={{ width: largura }} aria-hidden="true" />;
}
