// Mensagem de uso único para a tela de entrar (ex.: "conta excluída"), que sobrevive ao redirecionamento.
const CHAVE = "fitpro:aviso-login";

export function avisarNoLogin(mensagem: string | null) {
  try {
    if (mensagem) sessionStorage.setItem(CHAVE, mensagem);
    else sessionStorage.removeItem(CHAVE);
  } catch {}
}

export function consumirAvisoLogin(): string | null {
  try {
    const m = sessionStorage.getItem(CHAVE);
    sessionStorage.removeItem(CHAVE);
    return m;
  } catch {
    return null;
  }
}
