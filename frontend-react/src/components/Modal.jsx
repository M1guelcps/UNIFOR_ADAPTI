import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

// <dialog> nativo: já traz foco preso, tecla Esc e fundo escurecido.
export function Modal({ aberto, aoFechar, largo, titulo, children }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (aberto && !dialog.open) dialog.showModal();
    if (!aberto && dialog.open) dialog.close();
  }, [aberto]);

  return (
    <dialog
      ref={ref}
      className={`modal${largo ? " largo" : ""}`}
      aria-label={titulo}
      onClose={aoFechar}
      onClick={(e) => {
        if (e.target === ref.current) aoFechar(); // clique no fundo
      }}
    >
      {aberto && children}
    </dialog>
  );
}

// Confirmação bonita no lugar do confirm() do navegador.
// Uso: const confirmar = useConfirmar(); if (await confirmar({ titulo, texto })) ...
const ConfirmarContext = createContext(async () => false);

export function ConfirmarProvider({ children }) {
  const [pedido, setPedido] = useState(null);

  const confirmar = useCallback(
    (opcoes) => new Promise((resolver) => setPedido({ ...opcoes, resolver })),
    []
  );

  function responder(valor) {
    pedido?.resolver(valor);
    setPedido(null);
  }

  return (
    <ConfirmarContext.Provider value={confirmar}>
      {children}
      <Modal aberto={!!pedido} aoFechar={() => responder(false)} titulo={pedido?.titulo}>
        {pedido && (
          <div className="form-painel confirmar">
            <h2 className="titulo-aba">{pedido.titulo}</h2>
            {pedido.texto && <p>{pedido.texto}</p>}
            <div className="navegacao">
              <button type="button" className="botao-secundario" onClick={() => responder(false)}>
                Cancelar
              </button>
              <button type="button" className={pedido.perigo ? "botao-perigo" : "botao-principal"} onClick={() => responder(true)} autoFocus>
                {pedido.confirmar || "Confirmar"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </ConfirmarContext.Provider>
  );
}

export function useConfirmar() {
  return useContext(ConfirmarContext);
}
