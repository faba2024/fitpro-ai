// Quem responde pelo app perante a LGPD (controlador). PREENCHER ANTES DO LANÇAMENTO:
// enquanto estiver vazio, as páginas de Termos e Privacidade avisam que esses dados faltam.
export const CONTROLADOR = {
  /** nome da pessoa ou empresa responsável */
  nome: "",
  /** CPF ou CNPJ */
  documento: "",
  /** e-mail para pedidos sobre dados pessoais (encarregado/DPO) */
  email: "",
};

/** Data da versão atual dos textos (AAAA-MM-DD). Ao mudar o texto, mude a data. */
export const VERSAO_TEXTOS = "2026-10-29";

export const controladorPreenchido = () => Boolean(CONTROLADOR.nome.trim() && CONTROLADOR.documento.trim() && CONTROLADOR.email.trim());
