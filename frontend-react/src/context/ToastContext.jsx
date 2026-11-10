import { createContext, useCallback, useContext, useRef, useState } from "react";

// Avisos flutuantes no canto da tela (substituem os alert()).
const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const proximoId = useRef(1);

  const fechar = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const avisar = useCallback(
    (texto, tipo = "sucesso") => {
      const id = proximoId.current++;
      setToasts((t) => [...t.slice(-3), { id, texto, tipo }]);
      setTimeout(() => fechar(id), tipo === "erro" ? 7000 : 4500);
    },
    [fechar]
  );

  return (
    <ToastContext.Provider value={avisar}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tipo}`} role={t.tipo === "erro" ? "alert" : "status"}>
            <span>{t.texto}</span>
            <button type="button" onClick={() => fechar(t.id)} aria-label="Fechar aviso">×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
