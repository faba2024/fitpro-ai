import { Camera, Lock, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useDados } from "@/app/dados";
import { Button, EmptyState } from "@/components/ui";
import { chaveDia } from "@/domain/datas";
import { dataLocal } from "@/domain/evolucao";
import type { Foto, PoseFoto } from "@/domain/tipos";
import { reduzirImagem } from "@/lib/imagem";
import s from "./Evolucao.module.css";

const POSES: Record<PoseFoto, string> = { frente: "Frente", lado: "Lado", costas: "Costas" };

/** Fotos de evolução: privadas (só a própria pessoa vê), com comparação lado a lado. */
export function Fotos() {
  const { suportaFotos, listarFotos, enviarFoto, excluirFoto } = useDados();
  const [estado, setEstado] = useState<{ status: "carregando" } | { status: "erro"; msg: string } | { status: "pronto"; fotos: Foto[] }>({ status: "carregando" });
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [data, setData] = useState(chaveDia(new Date()));
  const [pose, setPose] = useState<PoseFoto>("frente");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [comparar, setComparar] = useState<string[]>([]);

  const carregar = useCallback(() => {
    if (!suportaFotos) return;
    setEstado({ status: "carregando" });
    listarFotos()
      .then((fotos) => setEstado({ status: "pronto", fotos }))
      .catch((e) => setEstado({ status: "erro", msg: e instanceof Error ? e.message : "Não foi possível carregar as fotos." }));
  }, [suportaFotos, listarFotos]);

  useEffect(carregar, [carregar]);

  if (!suportaFotos) {
    return <EmptyState icone={<Lock />} titulo="Fotos ficam disponíveis com conta" texto="Para ficarem protegidas e privadas, as fotos de evolução são guardadas na sua conta, não no navegador." />;
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!arquivo) return setErro("Escolha uma foto.");
    setEnviando(true);
    setErro(null);
    try {
      const reduzida = await reduzirImagem(arquivo);
      await enviarFoto(reduzida, data, pose);
      setArquivo(null);
      (e.target as HTMLFormElement).reset();
      carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível enviar.");
    } finally {
      setEnviando(false);
    }
  }

  const fotos = estado.status === "pronto" ? estado.fotos : [];
  const escolhidas = comparar.map((id) => fotos.find((f) => f.id === id)).filter((f): f is Foto => !!f).sort((a, b) => a.data.localeCompare(b.data));
  const alternar = (id: string) => setComparar((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c.slice(-1), id]));

  return (
    <div className={s.fotos}>
      <p className={s.linhaIcone}><Lock aria-hidden="true" /> Só você vê suas fotos. Nem o professor tem acesso. Elas são reduzidas e os dados de localização da câmera são removidos antes do envio.</p>

      <form className={s.formFoto} onSubmit={enviar}>
        <label className={s.arquivo}>
          <Camera aria-hidden="true" />
          <span>{arquivo ? arquivo.name : "Escolher ou tirar foto"}</span>
          <input type="file" accept="image/*" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
        </label>
        <label className={s.selectPequeno}>
          <span className="sr-only">Data da foto</span>
          <input type="date" value={data} max={chaveDia(new Date())} onChange={(e) => setData(e.target.value)} />
        </label>
        <label className={s.selectPequeno}>
          <span className="sr-only">Posição</span>
          <select value={pose} onChange={(e) => setPose(e.target.value as PoseFoto)}>
            {(Object.keys(POSES) as PoseFoto[]).map((p) => <option key={p} value={p}>{POSES[p]}</option>)}
          </select>
        </label>
        <Button type="submit" disabled={enviando || !arquivo}>{enviando ? "Enviando…" : "Enviar"}</Button>
      </form>
      {erro && <p className={s.erro} role="alert">{erro}</p>}

      {escolhidas.length === 2 && (
        <div className={s.comparacao} aria-label="Comparação de fotos">
          {escolhidas.map((f) => (
            <figure key={f.id}>
              <img src={f.url} alt={`Foto de ${POSES[f.pose].toLowerCase()} em ${f.data}`} />
              <figcaption>{dataLocal(f.data).toLocaleDateString("pt-BR")} · {POSES[f.pose]}</figcaption>
            </figure>
          ))}
        </div>
      )}

      {estado.status === "carregando" && <p className={s.mini}>Carregando fotos…</p>}
      {estado.status === "erro" && <p className={s.erro} role="alert">{estado.msg}</p>}
      {estado.status === "pronto" && !fotos.length && <p className={s.mini}>Nenhuma foto ainda. Tire fotos na mesma luz e posição para comparar ao longo do tempo.</p>}
      {fotos.length > 0 && (
        <>
          <p className={s.mini}>Toque em duas fotos para comparar lado a lado.</p>
          <ul className={s.galeria}>
            {fotos.map((f) => (
              <li key={f.id} className={comparar.includes(f.id) ? s.fotoEscolhida : undefined}>
                <button type="button" className={s.fotoBotao} aria-pressed={comparar.includes(f.id)} onClick={() => alternar(f.id)}>
                  <img src={f.url} alt={`Foto de ${POSES[f.pose].toLowerCase()} em ${f.data}`} loading="lazy" />
                  <span>{dataLocal(f.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} · {POSES[f.pose]}</span>
                </button>
                <button
                  type="button"
                  className={s.apagarFoto}
                  aria-label={`Apagar foto de ${f.data}`}
                  onClick={() => {
                    if (!confirm("Apagar esta foto definitivamente?")) return;
                    excluirFoto(f)
                      .then(() => {
                        setComparar((c) => c.filter((x) => x !== f.id));
                        carregar();
                      })
                      .catch((e) => setErro(e instanceof Error ? e.message : "Não foi possível apagar."));
                  }}
                >
                  <Trash2 />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
