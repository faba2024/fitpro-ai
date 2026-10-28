import { useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import { NAV, NAV_EXTRA } from "@/app/rotas";
import { useDados } from "@/app/dados";
import { Logo } from "./Logo";
import s from "./AppShell.module.css";

export function AppShell() {
  const { pathname } = useLocation();
  const { modo } = useDados();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className={s.shell}>
      <a href="#conteudo" className={s.pular}>Pular para o conteúdo</a>

      <aside className={s.lateral} aria-label="Navegação principal">
        <Logo />
        <nav className={s.navLateral}>
          {[...NAV, ...NAV_EXTRA].map(({ para, rotulo, icone: Icone }) => (
            <NavLink key={para} to={para} end={para === "/"} className={({ isActive }) => (isActive ? `${s.itemLateral} ${s.ativo}` : s.itemLateral)}>
              <Icone aria-hidden="true" />
              {rotulo}
            </NavLink>
          ))}
        </nav>
        {modo === "local" && (
          <NavLink to="/perfil" className={s.modo}>
            Modo local
            <span>Dados só neste navegador</span>
          </NavLink>
        )}
      </aside>

      <main id="conteudo" className={s.conteudo}>
        <Outlet />
      </main>

      <nav className={s.inferior} aria-label="Navegação principal">
        {NAV.map(({ para, rotulo, icone: Icone }) => (
          <NavLink key={para} to={para} end={para === "/"} className={({ isActive }) => (isActive ? `${s.itemInferior} ${s.ativo}` : s.itemInferior)}>
            <Icone aria-hidden="true" />
            <span>{rotulo}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
