import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Tema = "sistema" | "claro" | "escuro";

const CHAVE = "fitpro:tema";
const TemaCtx = createContext<{ tema: Tema; setTema: (t: Tema) => void } | null>(null);

function lerTema(): Tema {
  try {
    const t = localStorage.getItem(CHAVE);
    return t === "claro" || t === "escuro" ? t : "sistema";
  } catch {
    return "sistema";
  }
}

export function TemaProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(lerTema);

  useEffect(() => {
    const raiz = document.documentElement;
    if (tema === "sistema") raiz.removeAttribute("data-theme");
    else raiz.setAttribute("data-theme", tema);
    try {
      if (tema === "sistema") localStorage.removeItem(CHAVE);
      else localStorage.setItem(CHAVE, tema);
    } catch {}
  }, [tema]);

  return <TemaCtx.Provider value={{ tema, setTema }}>{children}</TemaCtx.Provider>;
}

export function useTema() {
  const ctx = useContext(TemaCtx);
  if (!ctx) throw new Error("useTema fora do TemaProvider");
  return ctx;
}
