import { useEffect, useState } from "react";

// Barras horizontais (mesmo visual da tela de desempenho original).
// itens: [{ chave, rotulo, valor, total?, texto? }]
// Com "total", a barra mostra valor/total; sem ele, é proporcional ao maior valor.
export function Barras({ itens, vazio = "Sem dados ainda." }) {
  if (!itens.length) {
    return (
      <ul className="barras">
        <li className="vazio">{vazio}</li>
      </ul>
    );
  }
  const maior = Math.max(...itens.map((i) => i.total ?? i.valor), 1);
  return (
    <ul className="barras">
      {itens.map((i) => {
        const largura = i.total !== undefined ? (i.valor / Math.max(i.total, 1)) * 100 : (i.valor / maior) * 100;
        return (
          <li className="barra-linha" key={i.chave ?? i.rotulo}>
            <span className="barra-rotulo" title={i.rotulo}>{i.rotulo}</span>
            <span className="barra-fundo">
              <span className="barra-cheia" style={{ width: `${largura.toFixed(1)}%` }} />
            </span>
            <span className="barra-numero">{i.texto ?? i.valor}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function Paginacao({ meta, aoMudar }) {
  if (!meta || meta.totalPages <= 1) return null;
  return (
    <div className="paginacao">
      <button type="button" className="botao-pequeno" disabled={meta.page <= 1} onClick={() => aoMudar(meta.page - 1)}>
        Anterior
      </button>
      <span>Página {meta.page} de {meta.totalPages}</span>
      <button type="button" className="botao-pequeno" disabled={meta.page >= meta.totalPages} onClick={() => aoMudar(meta.page + 1)}>
        Próxima
      </button>
    </div>
  );
}

// Valor que só atualiza depois que a pessoa para de digitar (busca da tabela)
export function useDebounce(valor, ms = 350) {
  const [atrasado, setAtrasado] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setAtrasado(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return atrasado;
}
