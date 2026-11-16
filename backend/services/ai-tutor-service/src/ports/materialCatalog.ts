import type { Material } from "../schemas/tutorResponse.js";

/**
 * Porta do catálogo de materiais de estudo do Adapti (tabela study_materials).
 * É a ÚNICA fonte de links da resposta: o modelo escolhe assuntos de uma lista, o catálogo traz os links.
 */
export interface MaterialCatalog {
  /** Assuntos com ao menos um material ativo na disciplina (lista oferecida ao modelo). Vazio sem disciplina. */
  listTopics(disciplina: string | undefined): Promise<string[]>;

  /** Materiais ativos da disciplina nos assuntos pedidos, no máximo `limit`, em ordem estável. */
  findMaterials(disciplina: string | undefined, assuntos: string[], limit: number): Promise<Material[]>;
}
