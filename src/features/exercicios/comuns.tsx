import { Heart, ImageOff } from "lucide-react";
import { useState } from "react";
import { useDados } from "@/app/dados";
import { urlImagem, type Exercicio } from "@/domain/exercicios";
import type { Nivel } from "@/domain/tipos";
import type { Tom } from "@/components/ui";
import s from "./Exercicios.module.css";

export const TOM_NIVEL: Record<Nivel, Tom> = { iniciante: "sucesso", intermediario: "alerta", avancado: "perigo" };

/** Foto do acervo com carregamento preguiçoso e aviso quando não carrega (ex.: sem internet). */
export function ImagemExercicio({ ex, quadro = 0, prioridade }: { ex: Exercicio; quadro?: 0 | 1; prioridade?: boolean }) {
  const [falhou, setFalhou] = useState(false);
  if (falhou) {
    return (
      <div className={s.semImagem} role="img" aria-label={`Foto de ${ex.nome} indisponível`}>
        <ImageOff aria-hidden="true" />
        <span>Foto indisponível</span>
      </div>
    );
  }
  return (
    <img
      src={urlImagem(ex, quadro)}
      alt={`${ex.nome}: ${quadro === 0 ? "posição inicial" : "posição final"}`}
      loading={prioridade ? "eager" : "lazy"}
      decoding="async"
      width={400}
      height={300}
      onError={() => setFalhou(true)}
    />
  );
}

export function BotaoFavorito({ ex, aoErro }: { ex: Exercicio; aoErro?: (m: string) => void }) {
  const { favoritos, alternarFavorito } = useDados();
  const ativo = favoritos.has(ex.id);
  return (
    <button
      type="button"
      className={ativo ? `${s.favorito} ${s.favoritoAtivo}` : s.favorito}
      aria-pressed={ativo}
      aria-label={ativo ? `Remover ${ex.nome} dos favoritos` : `Adicionar ${ex.nome} aos favoritos`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        alternarFavorito(ex.id).catch((err) => aoErro?.(err instanceof Error ? err.message : "Não foi possível salvar o favorito."));
      }}
    >
      <Heart aria-hidden="true" />
    </button>
  );
}
