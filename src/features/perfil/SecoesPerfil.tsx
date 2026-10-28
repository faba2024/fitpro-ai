import { TriangleAlert } from "lucide-react";
import { Campo, CampoTexto, Grupo, Opcao } from "@/components/ui";
import { EQUIPAMENTOS, NIVEIS, OBJETIVOS, PARQ, parqPedeLiberacao, type Equipamento, type Nivel, type Objetivo, type PerguntaParq } from "@/domain/tipos";
import type { CampoPerfil, Erros, FormPerfil } from "./validacao";
import s from "./Form.module.css";

export type Secao = "sobre" | "objetivo" | "equipamentos" | "saude" | "consentimento";

export const CAMPOS_DA_SECAO: Record<Secao, readonly CampoPerfil[]> = {
  sobre: ["nome", "dataNascimento", "alturaCm", "pesoKg"],
  objetivo: ["objetivo", "nivel", "diasSemana", "minutosSessao"],
  equipamentos: ["equipamentos"],
  saude: ["parq", "limitacoes"],
  consentimento: ["aceitaTermos", "aceitaSaude"],
};

export const TITULO_DA_SECAO: Record<Secao, string> = {
  sobre: "Sobre você",
  objetivo: "Objetivo e rotina",
  equipamentos: "Equipamentos",
  saude: "Saúde e segurança",
  consentimento: "Privacidade",
};

const DESCRICAO_OBJETIVO: Record<Objetivo, string> = {
  hipertrofia: "Ganhar massa muscular",
  emagrecimento: "Perder gordura e manter músculo",
  forca: "Levantar mais peso",
  condicionamento: "Mais fôlego e disposição",
  saude: "Movimento, postura e qualidade de vida",
};

const DESCRICAO_NIVEL: Record<Nivel, string> = {
  iniciante: "Menos de 6 meses de treino regular",
  intermediario: "De 6 meses a 2 anos",
  avancado: "Mais de 2 anos, com boa técnica",
};

const DURACOES = [30, 45, 60, 75, 90, 120];

interface Props {
  secao: Secao;
  form: FormPerfil;
  erros: Erros;
  mudar: (parcial: Partial<FormPerfil>) => void;
}

export function SecaoPerfil({ secao, form, erros, mudar }: Props) {
  switch (secao) {
    case "sobre":
      return (
        <div className={s.campos}>
          <Campo rotulo="Nome" autoComplete="name" value={form.nome} onChange={(e) => mudar({ nome: e.target.value })} erro={erros.nome} maxLength={80} />
          <Campo rotulo="Data de nascimento" type="date" autoComplete="bday" value={form.dataNascimento} onChange={(e) => mudar({ dataNascimento: e.target.value })} erro={erros.dataNascimento} />
          <div className={s.dupla}>
            <Campo rotulo="Altura (cm)" inputMode="decimal" placeholder="175" value={form.alturaCm} onChange={(e) => mudar({ alturaCm: e.target.value })} erro={erros.alturaCm} />
            <Campo rotulo="Peso (kg)" inputMode="decimal" placeholder="72,5" value={form.pesoKg} onChange={(e) => mudar({ pesoKg: e.target.value })} erro={erros.pesoKg} />
          </div>
        </div>
      );

    case "objetivo":
      return (
        <div className={s.campos}>
          <Grupo legenda="Qual é o seu principal objetivo?" erro={erros.objetivo}>
            {(Object.keys(OBJETIVOS) as Objetivo[]).map((o) => (
              <Opcao key={o} name="objetivo" rotulo={OBJETIVOS[o]} descricao={DESCRICAO_OBJETIVO[o]} checked={form.objetivo === o} onChange={() => mudar({ objetivo: o })} />
            ))}
          </Grupo>
          <Grupo legenda="Sua experiência com musculação" erro={erros.nivel}>
            {(Object.keys(NIVEIS) as Nivel[]).map((n) => (
              <Opcao key={n} name="nivel" rotulo={NIVEIS[n]} descricao={DESCRICAO_NIVEL[n]} checked={form.nivel === n} onChange={() => mudar({ nivel: n })} />
            ))}
          </Grupo>
          <Grupo legenda="Quantos dias por semana você pode treinar?" erro={erros.diasSemana}>
            <div className={s.dias}>
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <label key={d} className={form.diasSemana === d ? `${s.dia} ${s.diaAtivo}` : s.dia}>
                  <input type="radio" name="dias" className="sr-only" checked={form.diasSemana === d} onChange={() => mudar({ diasSemana: d })} />
                  {d}
                </label>
              ))}
            </div>
          </Grupo>
          <Grupo legenda="Quanto tempo por treino?" erro={erros.minutosSessao}>
            <div className={s.dias}>
              {DURACOES.map((m) => (
                <label key={m} className={form.minutosSessao === m ? `${s.dia} ${s.diaAtivo}` : s.dia}>
                  <input type="radio" name="duracao" className="sr-only" checked={form.minutosSessao === m} onChange={() => mudar({ minutosSessao: m })} />
                  {m} min
                </label>
              ))}
            </div>
          </Grupo>
        </div>
      );

    case "equipamentos":
      return (
        <Grupo legenda="O que você tem à disposição?" dica="Usamos isso para sugerir só exercícios que você consegue fazer." erro={erros.equipamentos}>
          <div className={s.grade}>
            {(Object.keys(EQUIPAMENTOS) as Equipamento[]).map((eq) => (
              <Opcao
                key={eq}
                tipo="checkbox"
                rotulo={EQUIPAMENTOS[eq]}
                checked={form.equipamentos.includes(eq)}
                onChange={(e) => mudar({ equipamentos: e.target.checked ? [...form.equipamentos, eq] : form.equipamentos.filter((x) => x !== eq) })}
              />
            ))}
          </div>
        </Grupo>
      );

    case "saude":
      return (
        <div className={s.campos}>
          <Grupo legenda="Questionário de prontidão (PAR-Q)" dica="Perguntas padrão antes de começar atividade física." erro={erros.parq}>
            {(Object.keys(PARQ) as PerguntaParq[]).map((p) => (
              <div key={p} className={s.parq} role="radiogroup" aria-label={PARQ[p]}>
                <p>{PARQ[p]}</p>
                <div className={s.simNao}>
                  {[true, false].map((v) => (
                    <label key={String(v)} className={form.parq[p] === v ? `${s.dia} ${s.diaAtivo}` : s.dia}>
                      <input type="radio" name={`parq-${p}`} className="sr-only" checked={form.parq[p] === v} onChange={() => mudar({ parq: { ...form.parq, [p]: v } })} />
                      {v ? "Sim" : "Não"}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </Grupo>
          {parqPedeLiberacao(form.parq) && (
            <div className={s.alerta} role="status">
              <TriangleAlert aria-hidden="true" />
              <p>
                Por causa das suas respostas, <b>procure um médico antes de começar ou aumentar a intensidade dos treinos</b>. Você pode continuar usando o app; os treinos sugeridos serão conservadores e recomendaremos acompanhamento profissional.
              </p>
            </div>
          )}
          <CampoTexto
            rotulo="Lesões, dores ou limitações (opcional)"
            dica="Ex.: dor no joelho direito ao agachar, cirurgia no ombro em 2023. O app evita exercícios que agravem isso, mas não substitui orientação médica."
            value={form.limitacoes}
            onChange={(e) => mudar({ limitacoes: e.target.value })}
            erro={erros.limitacoes}
            maxLength={1000}
          />
        </div>
      );

    case "consentimento":
      return (
        <div className={s.campos}>
          <p className={s.texto}>
            Seus dados de saúde (medidas, respostas do questionário e limitações) são <b>dados sensíveis pela LGPD</b>. Eles ficam protegidos na sua conta, são usados só para montar e ajustar seus treinos, e você pode excluir tudo a qualquer momento em Perfil.
          </p>
          <Opcao tipo="checkbox" rotulo="Li e aceito os Termos de Uso e a Política de Privacidade" checked={form.aceitaTermos} onChange={(e) => mudar({ aceitaTermos: e.target.checked })} />
          {erros.aceitaTermos && <p className={s.erro} role="alert">{erros.aceitaTermos}</p>}
          <Opcao
            tipo="checkbox"
            rotulo="Autorizo o uso dos meus dados de saúde para personalizar os treinos"
            descricao="Se você tiver professor vinculado, ele também poderá vê-los."
            checked={form.aceitaSaude}
            onChange={(e) => mudar({ aceitaSaude: e.target.checked })}
          />
          {erros.aceitaSaude && <p className={s.erro} role="alert">{erros.aceitaSaude}</p>}
        </div>
      );
  }
}
