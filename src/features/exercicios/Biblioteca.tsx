import { Heart, Scan, Search, SearchX } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useDados } from "@/app/dados";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge, Button, ButtonLink, Card, EmptyState } from "@/components/ui";
import { EXERCICIOS } from "@/data/catalogo";
import { filtrar, GRUPOS, grupoDoExercicio, LICENCA_ACERVO, type Grupo } from "@/domain/exercicios";
import { NIVEIS, OBJETIVOS, type Nivel, type Objetivo } from "@/domain/tipos";
import { BotaoFavorito, ImagemExercicio, TOM_NIVEL } from "./comuns";
import s from "./Exercicios.module.css";

const ehGrupo = (v: string | null): v is Grupo => !!v && v in GRUPOS;
const ehNivel = (v: string | null): v is Nivel => !!v && v in NIVEIS;
const ehObjetivo = (v: string | null): v is Objetivo => !!v && v in OBJETIVOS;

/** Filtros ficam na URL: voltar do detalhe mantém a busca, e dá para compartilhar o link. */
export function Biblioteca() {
  const { estado, favoritos } = useDados();
  const [params, setParams] = useSearchParams();
  const [erro, setErro] = useState<string | null>(null);
  const perfil = estado.status === "pronto" ? estado.dados.perfilCompleto : null;
  const meusEquipamentos = perfil?.equipamentos ?? null;
  const podeFiltrarEquip = !!meusEquipamentos && !meusEquipamentos.includes("academia_completa");

  const texto = params.get("q") ?? "";
  const grupo = ehGrupo(params.get("grupo")) ? (params.get("grupo") as Grupo) : null;
  const nivel = ehNivel(params.get("nivel")) ? (params.get("nivel") as Nivel) : null;
  const objetivo = ehObjetivo(params.get("objetivo")) ? (params.get("objetivo") as Objetivo) : null;
  const soMeus = podeFiltrarEquip && params.get("todos") !== "1";
  const soFavoritos = params.get("fav") === "1";

  function mudar(chave: string, valor: string | null) {
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        if (valor) n.set(chave, valor);
        else n.delete(chave);
        return n;
      },
      { replace: true },
    );
  }

  const lista = useMemo(
    () =>
      filtrar(EXERCICIOS, {
        texto,
        grupo,
        dificuldade: nivel,
        objetivo,
        equipamentos: soMeus ? meusEquipamentos : null,
        favoritos: soFavoritos ? favoritos : null,
      }),
    [texto, grupo, nivel, objetivo, soMeus, meusEquipamentos, soFavoritos, favoritos],
  );

  const temFiltro = !!(texto || grupo || nivel || objetivo || soFavoritos);

  return (
    <div className={s.pagina}>
      <PageHeader
        titulo="Exercícios"
        subtitulo={`${EXERCICIOS.length} exercícios com passo a passo, músculos e alternativas`}
        acao={<ButtonLink to="/anatomia" variante="secundario" icone={<Scan />}>Mapa muscular</ButtonLink>}
      />

      <div className={s.busca}>
        <Search aria-hidden="true" />
        <input type="search" placeholder="Buscar por nome ou músculo" aria-label="Buscar exercício" value={texto} onChange={(e) => mudar("q", e.target.value || null)} />
      </div>

      <div className={s.chips} role="group" aria-label="Grupo muscular">
        <button type="button" className={!grupo ? `${s.chip} ${s.chipAtivo}` : s.chip} aria-pressed={!grupo} onClick={() => mudar("grupo", null)}>Todos</button>
        {(Object.keys(GRUPOS) as Grupo[]).map((g) => (
          <button key={g} type="button" className={grupo === g ? `${s.chip} ${s.chipAtivo}` : s.chip} aria-pressed={grupo === g} onClick={() => mudar("grupo", grupo === g ? null : g)}>
            {GRUPOS[g].rotulo}
          </button>
        ))}
      </div>

      <div className={s.filtros}>
        <label className={s.select}>
          <span className="sr-only">Dificuldade</span>
          <select value={nivel ?? ""} onChange={(e) => mudar("nivel", e.target.value || null)}>
            <option value="">Qualquer nível</option>
            {(Object.keys(NIVEIS) as Nivel[]).map((n) => <option key={n} value={n}>{NIVEIS[n]}</option>)}
          </select>
        </label>
        <label className={s.select}>
          <span className="sr-only">Objetivo</span>
          <select value={objetivo ?? ""} onChange={(e) => mudar("objetivo", e.target.value || null)}>
            <option value="">Qualquer objetivo</option>
            {(Object.keys(OBJETIVOS) as Objetivo[]).map((o) => <option key={o} value={o}>{OBJETIVOS[o]}</option>)}
          </select>
        </label>
        <button type="button" className={soFavoritos ? `${s.chip} ${s.chipAtivo}` : s.chip} aria-pressed={soFavoritos} onClick={() => mudar("fav", soFavoritos ? null : "1")}>
          <Heart aria-hidden="true" /> Favoritos
        </button>
        {podeFiltrarEquip && (
          <label className={s.alternar}>
            <input type="checkbox" checked={soMeus} onChange={(e) => mudar("todos", e.target.checked ? null : "1")} />
            Só com meus equipamentos
          </label>
        )}
      </div>

      {erro && <p className={s.erro} role="alert">{erro}</p>}

      <p className={s.contagem} aria-live="polite">{lista.length} {lista.length === 1 ? "exercício" : "exercícios"}</p>

      {lista.length ? (
        <ul className={s.grade}>
          {lista.map((ex) => (
            <li key={ex.id}>
              <Link to={`/exercicios/${ex.id}`} className={s.cartao}>
                <div className={s.foto}>
                  <ImagemExercicio ex={ex} />
                  <BotaoFavorito ex={ex} aoErro={setErro} />
                </div>
                <div className={s.info}>
                  <strong>{ex.nome}</strong>
                  <div className={s.badges}>
                    <Badge tom="destaque">{GRUPOS[grupoDoExercicio(ex)].rotulo}</Badge>
                    <Badge tom={TOM_NIVEL[ex.dificuldade]}>{NIVEIS[ex.dificuldade]}</Badge>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Card>
          <EmptyState
            icone={<SearchX />}
            titulo={soFavoritos && !favoritos.size ? "Você ainda não tem favoritos" : "Nenhum exercício encontrado"}
            texto={soFavoritos && !favoritos.size ? "Toque no coração de um exercício para guardá-lo aqui." : "Tente outro termo ou tire alguns filtros."}
            acao={temFiltro || soMeus ? <Button variante="secundario" onClick={() => setParams({}, { replace: true })}>Limpar filtros</Button> : undefined}
          />
        </Card>
      )}

      <p className={s.credito}>{LICENCA_ACERVO}</p>
    </div>
  );
}
