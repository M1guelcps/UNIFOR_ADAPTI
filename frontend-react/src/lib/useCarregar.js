import { useCallback, useEffect, useRef, useState } from "react";

// Busca dados ao montar (e quando deps mudam), com estado de carregando/erro.
// Respostas antigas que chegam atrasadas são descartadas.
export function useCarregar(buscar, deps = []) {
  const [estado, setEstado] = useState({ dados: null, carregando: true, erro: null });
  const versao = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const executar = useCallback(buscar, deps);

  const recarregar = useCallback(async () => {
    const minha = ++versao.current;
    setEstado((e) => ({ ...e, carregando: true, erro: null }));
    try {
      const dados = await executar();
      if (minha === versao.current) setEstado({ dados, carregando: false, erro: null });
    } catch (erro) {
      if (minha === versao.current) setEstado((e) => ({ ...e, carregando: false, erro: erro.message }));
    }
  }, [executar]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  return { ...estado, recarregar };
}
