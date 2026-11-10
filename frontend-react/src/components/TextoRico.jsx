// Renderiza o enunciado com segurança: o texto NUNCA vira HTML.
// Entende só o que as questões do ENEM usam: parágrafos, quebras de linha,
// imagens em markdown ![alt](url) e **negrito**/*itálico*.
const IMAGEM = /!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g;

function urlSegura(url) {
  return /^https?:\/\//i.test(url) ? url : null;
}

// Escapes de markdown que vêm nas questões do ENEM: \[...\] -> [...]
function semEscapes(texto) {
  return texto.replace(/\\([\\`*_{}[\]()#+\-.!|>~])/g, "$1");
}

function formatarInline(texto, chaveBase) {
  // **negrito** e *itálico*; o resto é texto puro (React já escapa)
  const partes = texto.split(/(\*\*[^*]+\*\*|(?<!\\)\*[^*\n]+(?<!\\)\*)/g);
  return partes.map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={`${chaveBase}-${i}`}>{semEscapes(p.slice(2, -2))}</strong>;
    if (/^\*[^*\n]+\*$/.test(p)) return <em key={`${chaveBase}-${i}`}>{semEscapes(p.slice(1, -1))}</em>;
    return semEscapes(p);
  });
}

function renderizarParagrafo(texto, chave) {
  const elementos = [];
  let ultimo = 0;
  let m;
  IMAGEM.lastIndex = 0;

  while ((m = IMAGEM.exec(texto)) !== null) {
    if (m.index > ultimo) elementos.push(...comQuebras(texto.slice(ultimo, m.index), `${chave}-t${m.index}`));
    const url = urlSegura(m[2]);
    if (url) {
      elementos.push(
        <img key={`${chave}-img${m.index}`} className="enunciado-imagem" src={url} alt={m[1] || "Imagem da questão"} loading="lazy" />
      );
    }
    ultimo = m.index + m[0].length;
  }
  if (ultimo < texto.length) elementos.push(...comQuebras(texto.slice(ultimo), `${chave}-fim`));

  const soImagem = elementos.every((e) => typeof e === "object" && e?.type === "img");
  return soImagem ? (
    <div key={chave} className="enunciado-figuras">{elementos}</div>
  ) : (
    <p key={chave}>{elementos}</p>
  );
}

function comQuebras(texto, chave) {
  const linhas = texto.split("\n");
  return linhas.flatMap((linha, i) => {
    const conteudo = formatarInline(linha.replace(/^#+\s*/, ""), `${chave}-${i}`);
    return i < linhas.length - 1 ? [...conteudo, <br key={`${chave}-br${i}`} />] : conteudo;
  });
}

export default function TextoRico({ texto, className }) {
  const paragrafos = String(texto ?? "")
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return <div className={className}>{paragrafos.map((p, i) => renderizarParagrafo(p, `p${i}`))}</div>;
}
