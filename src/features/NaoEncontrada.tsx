import { MapPinOff } from "lucide-react";
import { ButtonLink, EmptyState } from "@/components/ui";

export function NaoEncontrada() {
  return (
    <EmptyState
      icone={<MapPinOff />}
      titulo="Página não encontrada"
      texto="O endereço pode estar errado ou a página mudou de lugar."
      acao={<ButtonLink to="/">Ir para o início</ButtonLink>}
    />
  );
}
