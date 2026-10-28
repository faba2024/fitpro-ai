import { PersonStanding, RotateCcw } from "lucide-react";
import { useMemo } from "react";
import { Link, useSearchParams } from "react-router";
import { useDados } from "@/app/dados";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge, Card, EmptyState } from "@/components/ui";
import { EXERCICIOS } from "@/data/catalogo";
import { exerciciosDoMusculo, GRUPOS, grupoDoMusculo, MUSCULOS, type Exercicio, type Musculo } from "@/domain/exercicios";
import { NIVEIS, OBJETIVOS, type Nivel, type Objetivo } from "@/domain/tipos";
import { ImagemExercicio, TOM_NIVEL } from "@/features/exercicios/comuns";
import { MapaCorpo } from "./MapaCorpo";
import { vistasDoMusculo, type Vista } from "./regioes";
import s from "./Anatomia.module.css";

const ehMusculo = (v: string | null): v is Musculo => !!v && v in MUSCULOS;

/** Mapa muscular 2D: escolha um músculo (no desenho ou na lista) e veja os exercícios dele. */
export function Anatomia() {
  const { estado } = useDados();
  const [params, setParams] = useSearchParams();
  const perfil = estado.status === "pronto" ? estado.dados.perfilCompleto : null;
  const meus = perfil?.equipamentos ?? null;
  const podeFiltrarEquip = !!meus && !meus.includes("academia_completa");

  const musculo = ehMusculo(params.get("musculo")) ? (params.get("musculo") as Musculo) : null;
  const vistaParam = params.get("vista") === "costas" ? "costas" : params.get("vista") === "frente" ? "frente" : null;
  // sem vista na URL: a primeira em que o músculo aparece
  const vista: Vista = vistaParam ?? (musculo ? vistasDoMusculo(musculo)[0]! : "frente");
  const nivel = params.get("nivel") as Nivel | null;
  const objetivo = params.get("objetivo") as Objetivo | null;
  const soMeus = podeFiltrarEquip && params.get("todos") !== "1";

  function mudar(valores: Record<string, string | null>) {
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        for (const [k, v] of Object.entries(valores)) {
          if (v) n.set(k, v);
          else n.delete(k);
        }
        return n;
      },
      { replace: true },
    );
  }

  function selecionar(m: Musculo) {
    // tocar de novo no mesmo músculo desmarca
    mudar({ musculo: m === musculo ? null : m, vista: vistasDoMusculo(m).includes(vista) ? vista : vistasDoMusculo(m)[0]! });
  }

  const resultado = useMemo(
    () =>
      musculo
        ? exerciciosDoMusculo(EXERCICIOS, musculo, {
            dificuldade: nivel && nivel in NIVEIS ? nivel : null,
            objetivo: objetivo && objetivo in OBJETIVOS ? objetivo : null,
            equipamentos: soMeus ? meus : null,
          })
        : null,
    [musculo, nivel, objetivo, soMeus, meus],
  );

  const daVista = (Object.keys(MUSCULOS) as Musculo[]).filter((m) => vistasDoMusculo(m).includes(vista));
  const selecionados = new Set(musculo ? [musculo] : []);

  return (
    <div className={s.pagina}>
      <PageHeader titulo="Mapa muscular" subtitulo="Toque em um músculo para ver os exercícios que o trabalham." />

      <div className={s.layout}>
        <section className={s.painelMapa} aria-label="Mapa do corpo">
          <div className={s.abas} role="group" aria-label="Vista">
            {(["frente", "costas"] as const).map((v) => (
              <button key={v} type="button" aria-pressed={vista === v} className={vista === v ? `${s.aba} ${s.abaAtiva}` : s.aba} onClick={() => mudar({ vista: v })}>
                {v === "frente" ? "Frente" : "Costas"}
              </button>
            ))}
            <button type="button" className={s.girar} onClick={() => mudar({ vista: vista === "frente" ? "costas" : "frente" })} aria-label="Girar o corpo">
              <RotateCcw aria-hidden="true" />
            </button>
          </div>

          <MapaCorpo vista={vista} principais={selecionados} aoSelecionar={selecionar} className={s.mapaGrande} />

          <div className={s.listaMusculos} role="group" aria-label={`Músculos visíveis de ${vista}`}>
            {daVista.map((m) => (
              <button key={m} type="button" aria-pressed={musculo === m} className={musculo === m ? `${s.chip} ${s.chipAtivo}` : s.chip} onClick={() => selecionar(m)}>
                {MUSCULOS[m]}
              </button>
            ))}
          </div>
        </section>

        <section className={s.painelLista} aria-live="polite">
          {!musculo || !resultado ? (
            <Card>
              <EmptyState icone={<PersonStanding />} titulo="Escolha um músculo" texto="Toque no desenho ou nos nomes abaixo dele. Use “Costas” para ver glúteos, dorsais, posteriores e mais." />
            </Card>
          ) : (
            <>
              <div className={s.cabMusculo}>
                <h2>{MUSCULOS[musculo]}</h2>
                <Badge tom="destaque">{GRUPOS[grupoDoMusculo(musculo)].rotulo}</Badge>
              </div>

              <div className={s.filtros}>
                <label className={s.select}>
                  <span className="sr-only">Dificuldade</span>
                  <select value={nivel ?? ""} onChange={(e) => mudar({ nivel: e.target.value || null })}>
                    <option value="">Qualquer nível</option>
                    {(Object.keys(NIVEIS) as Nivel[]).map((n) => <option key={n} value={n}>{NIVEIS[n]}</option>)}
                  </select>
                </label>
                <label className={s.select}>
                  <span className="sr-only">Objetivo</span>
                  <select value={objetivo ?? ""} onChange={(e) => mudar({ objetivo: e.target.value || null })}>
                    <option value="">Qualquer objetivo</option>
                    {(Object.keys(OBJETIVOS) as Objetivo[]).map((o) => <option key={o} value={o}>{OBJETIVOS[o]}</option>)}
                  </select>
                </label>
                {podeFiltrarEquip && (
                  <label className={s.alternar}>
                    <input type="checkbox" checked={soMeus} onChange={(e) => mudar({ todos: e.target.checked ? null : "1" })} />
                    Só com meus equipamentos
                  </label>
                )}
              </div>

              <ListaExercicios titulo="Trabalha como músculo principal" lista={resultado.principais} vazio="Nenhum exercício principal com esses filtros." />
              <ListaExercicios titulo="Também trabalha (secundário)" lista={resultado.secundarios} vazio="Nenhum exercício com esses filtros." />
            </>
          )}
        </section>
      </div>

      <p className={s.nota}>Desenho simplificado, para orientação. Os músculos de cada exercício seguem a ficha técnica da biblioteca.</p>
    </div>
  );
}

function ListaExercicios({ titulo, lista, vazio }: { titulo: string; lista: Exercicio[]; vazio: string }) {
  return (
    <Card titulo={`${titulo} (${lista.length})`}>
      {lista.length ? (
        <ul className={s.exercicios}>
          {lista.map((ex) => (
            <li key={ex.id}>
              <Link to={`/exercicios/${ex.id}`} className={s.exercicio}>
                <div className={s.miniFoto}><ImagemExercicio ex={ex} /></div>
                <div className={s.exInfo}>
                  <strong>{ex.nome}</strong>
                  <Badge tom={TOM_NIVEL[ex.dificuldade]}>{NIVEIS[ex.dificuldade]}</Badge>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className={s.vazio}>{vazio}</p>
      )}
    </Card>
  );
}
