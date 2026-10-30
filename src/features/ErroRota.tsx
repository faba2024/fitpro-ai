import { RefreshCw, TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { useRouteError } from "react-router";
import { Button, EmptyState } from "@/components/ui";

const CHAVE = "fitpro:recarregou-versao";

/** Arquivo de uma versão anterior do app que não existe mais no servidor (depois de uma publicação). */
export const ehVersaoAntiga = (e: unknown) =>
  e instanceof Error && /dynamically imported module|Importing a module script failed|Failed to fetch dynamically|error loading dynamically/i.test(e.message);

/** Tela para erros inesperados nas rotas, em vez da página branca. */
export function ErroRota() {
  const erro = useRouteError();
  const antiga = ehVersaoAntiga(erro);

  useEffect(() => {
    if (erro) console.error(erro);
    // nova versão publicada: recarrega uma vez sozinho para buscar os arquivos novos
    // (no máximo uma vez por minuto, para não entrar em ciclo se o problema for outro)
    const ultima = Number(sessionStorage.getItem(CHAVE) ?? 0);
    if (antiga && Date.now() - ultima > 60_000) {
      sessionStorage.setItem(CHAVE, String(Date.now()));
      window.location.reload();
    }
  }, [erro, antiga]);

  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 16, background: "var(--bg)" }}>
      <EmptyState
        nivel={1}
        icone={antiga ? <RefreshCw /> : <TriangleAlert />}
        titulo={antiga ? "Há uma versão nova do app" : "Algo deu errado"}
        texto={antiga ? "Recarregue para usar a versão atualizada." : "Seus dados salvos não foram afetados. Recarregue a página; se continuar, tente mais tarde."}
        acao={
          <Button
            icone={<RefreshCw />}
            onClick={() => {
              sessionStorage.removeItem(CHAVE);
              window.location.assign("/");
            }}
          >
            Recarregar
          </Button>
        }
      />
    </main>
  );
}
