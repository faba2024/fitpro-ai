import { Info } from "lucide-react";
import { useDados } from "@/app/dados";
import s from "./Estados.module.css";

/** Aviso fixo enquanto os dados exibidos forem de exemplo. */
export function AvisoExemplo() {
  const { exemplo, limpar } = useDados();
  if (!exemplo) return null;
  return (
    <div className={s.aviso} role="status">
      <Info aria-hidden="true" />
      <span>Você está vendo <b>dados de exemplo</b>.</span>
      <button type="button" onClick={() => void limpar()}>Limpar</button>
    </div>
  );
}
