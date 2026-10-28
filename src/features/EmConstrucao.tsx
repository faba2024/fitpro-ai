import { Construction } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ButtonLink, Card, EmptyState } from "@/components/ui";

/** Tela de uma etapa ainda não implementada. Diz isso com clareza em vez de simular a função. */
export function EmConstrucao({ titulo, etapa, texto }: { titulo: string; etapa: number; texto: string }) {
  return (
    <>
      <PageHeader titulo={titulo} />
      <Card>
        <EmptyState
          icone={<Construction />}
          titulo={`Chega na etapa ${etapa}`}
          texto={texto}
          acao={<ButtonLink to="/" variante="secundario">Voltar ao início</ButtonLink>}
        />
      </Card>
    </>
  );
}
