import { Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useDados } from "@/app/dados";
import { Button, Campo } from "@/components/ui";
import { chaveDia } from "@/domain/datas";
import { dataLocal, paraMedida, validarMedida, type ErrosMedida, type FormMedida } from "@/domain/evolucao";
import { CAMPOS_MEDIDA, type CampoMedida, type Medida } from "@/domain/tipos";
import s from "./Evolucao.module.css";

const fmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

const formVazio = (): FormMedida => ({
  data: chaveDia(new Date()),
  pesoKg: "",
  gorduraPct: "",
  cinturaCm: "",
  quadrilCm: "",
  peitoCm: "",
  bracoCm: "",
  coxaCm: "",
  panturrilhaCm: "",
});

/** Formulário de medidas do dia. Salvar de novo na mesma data atualiza o registro. */
export function FormularioMedidas({ aoSalvar }: { aoSalvar: () => void }) {
  const { salvarMedida } = useDados();
  const [f, setF] = useState<FormMedida>(formVazio);
  const [mais, setMais] = useState(false);
  const [erros, setErros] = useState<ErrosMedida>({});
  const [salvando, setSalvando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);

  const mudar = (c: keyof FormMedida, v: string) => {
    setF((x) => ({ ...x, [c]: v }));
    setErros((e) => ({ ...e, [c]: undefined, geral: undefined }));
  };

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const v = validarMedida(f, new Date());
    setErros(v);
    if (Object.keys(v).length) return;
    setSalvando(true);
    setErroEnvio(null);
    try {
      await salvarMedida(paraMedida(f));
      setF(formVazio());
      aoSalvar();
    } catch (err) {
      setErroEnvio(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form className={s.form} onSubmit={enviar} noValidate>
      <div className={s.dupla}>
        <Campo rotulo="Data" type="date" value={f.data} max={chaveDia(new Date())} onChange={(e) => mudar("data", e.target.value)} erro={erros.data} />
        <Campo rotulo="Peso (kg)" inputMode="decimal" placeholder="78,4" value={f.pesoKg} onChange={(e) => mudar("pesoKg", e.target.value)} erro={erros.pesoKg} />
      </div>
      <button type="button" className={s.linkBotao} aria-expanded={mais} onClick={() => setMais(!mais)}>
        {mais ? "Menos medidas" : "Mais medidas (gordura, cintura, braço…)"}
      </button>
      {mais && (
        <div className={s.gradeCampos}>
          {(Object.keys(CAMPOS_MEDIDA) as CampoMedida[]).map((c) => (
            <Campo key={c} rotulo={`${CAMPOS_MEDIDA[c].rotulo} (${CAMPOS_MEDIDA[c].unidade})`} inputMode="decimal" value={f[c]} onChange={(e) => mudar(c, e.target.value)} erro={erros[c]} />
          ))}
        </div>
      )}
      {erros.geral && <p className={s.erro} role="alert">{erros.geral}</p>}
      {erroEnvio && <p className={s.erro} role="alert">{erroEnvio}</p>}
      <p className={s.mini}>Para comparar bem, meça sempre no mesmo horário (de preferência pela manhã, em jejum). Já existe registro nesta data? Salvar de novo atualiza.</p>
      <Button type="submit" disabled={salvando}>{salvando ? "Salvando…" : "Salvar medidas"}</Button>
    </form>
  );
}

const texto = (m: Medida) =>
  [
    m.pesoKg != null && `${fmt.format(m.pesoKg)} kg`,
    ...(Object.keys(CAMPOS_MEDIDA) as CampoMedida[]).filter((c) => m[c] != null).map((c) => `${CAMPOS_MEDIDA[c].rotulo.toLowerCase()} ${fmt.format(m[c]!)} ${CAMPOS_MEDIDA[c].unidade}`),
  ]
    .filter(Boolean)
    .join(" · ");

export function HistoricoMedidas({ medidas }: { medidas: Medida[] }) {
  const { excluirMedida } = useDados();
  const [erro, setErro] = useState<string | null>(null);
  const lista = [...medidas].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 30);
  if (!lista.length) return <p className={s.mini}>Nenhuma medida registrada ainda.</p>;
  return (
    <>
      {erro && <p className={s.erro} role="alert">{erro}</p>}
      <ul className={s.listaMedidas}>
        {lista.map((m) => (
          <li key={m.id ?? m.data}>
            <span className={s.data}>{dataLocal(m.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}</span>
            <span className={s.valores}>{texto(m)}{!m.id && " (do cadastro)"}</span>
            {m.id && (
              <button
                type="button"
                className={s.iconeBtn}
                aria-label={`Apagar medidas de ${m.data}`}
                onClick={() => {
                  if (confirm("Apagar este registro de medidas?")) excluirMedida(m.id!).catch((e) => setErro(e instanceof Error ? e.message : "Não foi possível apagar."));
                }}
              >
                <Trash2 />
              </button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
