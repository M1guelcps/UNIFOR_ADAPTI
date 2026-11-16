/**
 * Normaliza um texto para servir de chave de comparação: minúsculas, sem acento, e qualquer
 * sequência de caracteres não alfanuméricos vira um único hífen.
 *
 *   "Matemática"            → "matematica"
 *   "Ciências da Natureza"  → "ciencias-da-natureza"
 *   "ciencias-natureza"     → "ciencias-natureza"   (já normalizada: não muda)
 *
 * É assim que a disciplina que chega no contrato ("Matemática", "matematica"…) casa com o `subject`
 * gravado no catálogo, independentemente de como cada serviço a escreve.
 */
export function normalizeKey(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
