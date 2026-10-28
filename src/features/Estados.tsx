import { CloudOff } from "lucide-react";
import { Button, EmptyState } from "@/components/ui";
import s from "./Estados.module.css";

export function Carregando({ rotulo = "Carregando…" }: { rotulo?: string }) {
  return (
    <div className={s.carregando} role="status" aria-live="polite">
      <div className={s.esqueleto} />
      <div className={s.esqueleto} style={{ height: 180 }} />
      <div className={s.esqueleto} />
      <span className="sr-only">{rotulo}</span>
    </div>
  );
}

export function ErroCarga({ mensagem, tentar }: { mensagem: string; tentar: () => void }) {
  return (
    <EmptyState
      icone={<CloudOff />}
      titulo="Não foi possível carregar"
      texto={mensagem}
      acao={<Button variante="secundario" onClick={tentar}>Tentar de novo</Button>}
    />
  );
}
