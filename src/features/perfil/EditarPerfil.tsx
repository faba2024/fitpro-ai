import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router";
import { useDados } from "@/app/dados";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button, ButtonLink, Card } from "@/components/ui";
import { CAMPOS_DA_SECAO, SecaoPerfil, TITULO_DA_SECAO, type Secao } from "./SecoesPerfil";
import { deFormulario, paraPerfil, validarPerfil, type Erros, type FormPerfil } from "./validacao";
import s from "./Perfil.module.css";

const SECOES: Secao[] = ["sobre", "objetivo", "equipamentos", "saude"];

export function EditarPerfil() {
  const { estado, salvarPerfil } = useDados();
  const navegar = useNavigate();
  const atual = estado.status === "pronto" ? estado.dados.perfilCompleto : null;
  const [form, setForm] = useState<FormPerfil | null>(atual ? deFormulario(atual) : null);
  const [erros, setErros] = useState<Erros>({});
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (!atual || !form) return <Navigate to="/perfil" replace />;

  function mudar(parcial: Partial<FormPerfil>) {
    setForm((f) => (f ? { ...f, ...parcial } : f));
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const v = validarPerfil(form!, new Date(), SECOES.flatMap((sec) => CAMPOS_DA_SECAO[sec]));
    setErros(v);
    if (Object.keys(v).length) {
      setErroEnvio("Revise os campos destacados.");
      return;
    }
    setEnviando(true);
    setErroEnvio(null);
    try {
      await salvarPerfil(paraPerfil(form!, new Date(), atual));
      navegar("/perfil", { replace: true, state: { salvo: true } });
    } catch (err) {
      setErroEnvio(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className={s.pagina} onSubmit={salvar} noValidate>
      <PageHeader titulo="Editar perfil" />
      {SECOES.map((sec) => (
        <Card key={sec} titulo={TITULO_DA_SECAO[sec]}>
          <SecaoPerfil secao={sec} form={form} erros={erros} mudar={mudar} />
        </Card>
      ))}
      {erroEnvio && <p className={s.erro} role="alert">{erroEnvio}</p>}
      <div className={s.acoes}>
        <ButtonLink to="/perfil" variante="secundario">Cancelar</ButtonLink>
        <Button type="submit" disabled={enviando}>{enviando ? "Salvando…" : "Salvar alterações"}</Button>
      </div>
    </form>
  );
}
