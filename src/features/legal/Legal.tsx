import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Logo } from "@/components/layout/Logo";
import { CONTROLADOR, controladorPreenchido, VERSAO_TEXTOS } from "@/config/legal";
import s from "./Legal.module.css";

const dataVersao = new Date(`${VERSAO_TEXTOS}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });

function Pagina({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <main className={s.tela}>
      <div className={s.caixa}>
        <Link to="/" className={s.marca} aria-label="FitPro AI, ir para o início"><Logo /></Link>
        <article className={s.texto}>
          <h1>{titulo}</h1>
          <p className={s.versao}>Versão de {dataVersao}</p>
          <Responsavel />
          {children}
        </article>
        <nav className={s.rodape} aria-label="Documentos">
          <Link to="/termos">Termos de Uso</Link>
          <Link to="/privacidade">Política de Privacidade</Link>
          <Link to="/">Voltar ao app</Link>
        </nav>
      </div>
    </main>
  );
}

function Responsavel() {
  if (!controladorPreenchido()) {
    return (
      <div className={s.aviso} role="note">
        <AlertTriangle aria-hidden="true" />
        <p>Os dados de identificação do responsável pelo app (nome, CPF/CNPJ e e-mail de contato) ainda não foram informados nesta versão.</p>
      </div>
    );
  }
  return (
    <p>
      Responsável (controlador dos dados): <b>{CONTROLADOR.nome}</b>, {CONTROLADOR.documento}. Contato para assuntos de dados pessoais:{" "}
      <a href={`mailto:${CONTROLADOR.email}`}>{CONTROLADOR.email}</a>.
    </p>
  );
}

const contato = () => (controladorPreenchido() ? <a href={`mailto:${CONTROLADOR.email}`}>{CONTROLADOR.email}</a> : "o e-mail de contato do responsável");

export function Termos() {
  return (
    <Pagina titulo="Termos de Uso">
      <h2>1. O que é o FitPro AI</h2>
      <p>
        O FitPro AI é um aplicativo para organizar treinos de musculação: monta fichas a partir do seu perfil, registra os treinos, mostra sua evolução,
        tem uma biblioteca de exercícios e um assistente de dúvidas. Academias podem usá-lo para ligar alunos a professores e registrar mensalidades.
      </p>

      <h2>2. Não substitui profissionais de saúde</h2>
      <p>
        As fichas e respostas do app são orientações gerais. <b>Não são diagnóstico nem prescrição médica</b> e não substituem a avaliação de um médico
        ou de um profissional de educação física. Se você respondeu “sim” a alguma pergunta do questionário de prontidão (PAR-Q), tem alguma limitação,
        está grávida, se recupera de lesão ou cirurgia, procure liberação médica antes de treinar. Pare o exercício e procure atendimento se sentir dor no
        peito, falta de ar fora do normal, tontura forte, desmaio ou dor aguda.
      </p>
      <p>
        As cargas sugeridas vêm do que você mesmo registrou nos treinos anteriores. Ajuste sempre ao que você consegue fazer com boa técnica.
      </p>

      <h2>3. Sua conta</h2>
      <ul>
        <li>Para criar uma conta você precisa ter pelo menos 18 anos, ou autorização e acompanhamento do responsável legal.</li>
        <li>As informações do cadastro devem ser verdadeiras; o app usa esses dados para montar seus treinos.</li>
        <li>Guarde sua senha. Você pode excluir sua conta a qualquer momento em Perfil; os dados são apagados de forma definitiva.</li>
      </ul>

      <h2>4. Assistente de IA</h2>
      <p>
        O assistente responde dúvidas sobre exercícios e treino usando um modelo de inteligência artificial. Ele pode errar: confira as orientações e,
        em caso de dúvida sobre saúde, fale com um profissional. Há um limite diário de perguntas por pessoa.
      </p>

      <h2>5. Academias, professores e mensalidades</h2>
      <ul>
        <li>Você só entra numa academia usando um código de convite e pode sair quando quiser.</li>
        <li>O professor responsável vê seu perfil, fichas, treinos e medidas enquanto você estiver vinculado a ele.</li>
        <li>
          O app <b>não cobra nem processa pagamentos</b>. A área de mensalidades é só um registro feito pela administração da academia. Combinações de
          preço, cobrança e cancelamento são entre você e a academia.
        </li>
      </ul>

      <h2>6. Uso aceitável</h2>
      <p>Não use o app para acessar dados de outras pessoas sem permissão, burlar limites ou atrapalhar o funcionamento do serviço.</p>

      <h2>7. Disponibilidade e mudanças</h2>
      <p>
        O serviço pode passar por manutenção ou ficar indisponível. Estes termos podem ser atualizados; a data da versão fica no topo da página e mudanças
        importantes serão avisadas no app.
      </p>

      <h2>8. Contato</h2>
      <p>Dúvidas sobre estes termos: {contato()}.</p>
    </Pagina>
  );
}

export function Privacidade() {
  return (
    <Pagina titulo="Política de Privacidade">
      <p>
        Esta política explica quais dados o FitPro AI trata, para quê e quais são os seus direitos pela Lei Geral de Proteção de Dados (Lei 13.709/2018).
      </p>

      <h2>1. Dados que tratamos</h2>
      <ul>
        <li><b>Conta:</b> e-mail e senha (a senha é guardada de forma cifrada pelo serviço de autenticação).</li>
        <li><b>Perfil:</b> nome, data de nascimento, altura, peso, objetivo, nível, rotina e equipamentos.</li>
        <li>
          <b>Dados de saúde (sensíveis):</b> respostas do questionário de prontidão (PAR-Q), limitações que você informar, medidas corporais e fotos de
          evolução.
        </li>
        <li><b>Treinos:</b> fichas, sessões, séries, cargas e repetições, favoritos.</li>
        <li><b>Academia:</b> vínculos (aluno, professor, administração), convites e mensalidades registradas.</li>
        <li><b>Assistente:</b> o número de perguntas feitas por dia. O texto das conversas não é guardado no servidor.</li>
      </ul>

      <h2>2. Para que usamos</h2>
      <ul>
        <li>Montar e ajustar seus treinos, registrar seu progresso e mostrar sua evolução (execução do serviço que você contratou).</li>
        <li>Dados de saúde: só com o seu <b>consentimento específico</b>, dado no cadastro, para personalizar os treinos com segurança.</li>
        <li>Permitir que o professor vinculado acompanhe você, quando você entra numa academia por convite.</li>
        <li>Segurança e limites de uso (por exemplo, o limite diário do assistente).</li>
      </ul>
      <p>Não vendemos seus dados e não os usamos para publicidade.</p>

      <h2>3. Quem vê o quê</h2>
      <ul>
        <li><b>Você</b> vê todos os seus dados.</li>
        <li><b>Professor vinculado:</b> perfil (incluindo limitações e PAR-Q), fichas, treinos e medidas. Não vê suas fotos.</li>
        <li><b>Administração da academia:</b> só seu nome, seu vínculo e os pagamentos registrados. Não vê dados de saúde, fichas, treinos nem fotos.</li>
        <li><b>Fotos de evolução:</b> só você, em armazenamento privado.</li>
      </ul>
      <p>Essas regras são aplicadas no próprio banco de dados, não apenas nas telas.</p>

      <h2>4. Serviços que usamos (operadores)</h2>
      <ul>
        <li><b>Supabase</b> — banco de dados, autenticação e armazenamento das fotos, em servidores na região de São Paulo.</li>
        <li><b>Vercel</b> — hospedagem do aplicativo e da função do assistente.</li>
        <li>
          <b>Anthropic</b> — modelo de IA do assistente, com servidores fora do Brasil (transferência internacional). Só recebe o que você escreve no
          assistente e, se você autorizar na própria tela, seu objetivo, nível, rotina e ficha; limitações e PAR-Q exigem uma segunda autorização.
          Nome, e-mail e data de nascimento nunca são enviados.
        </li>
      </ul>

      <h2>5. Por quanto tempo guardamos</h2>
      <p>
        Enquanto sua conta existir. Ao excluir a conta em Perfil, seus dados e fotos são apagados de forma definitiva. Registros de mensalidade feitos por
        uma academia são apagados junto com a sua conta. Cópias de segurança dos provedores podem levar alguns dias para expirar.
      </p>

      <h2>6. Seus direitos</h2>
      <p>
        Você pode confirmar se tratamos seus dados, acessá-los, corrigi-los (em Perfil), pedir a exclusão (Perfil → Excluir minha conta), revogar o
        consentimento sobre dados de saúde, pedir a portabilidade e saber com quem compartilhamos. Para qualquer pedido, escreva para {contato()}. Você
        também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).
      </p>
      <p>
        Revogar o consentimento sobre dados de saúde impede que o app personalize os treinos com segurança; nesse caso, o caminho é excluir a conta ou
        apagar as informações de saúde do perfil.
      </p>

      <h2>7. Segurança</h2>
      <p>
        Conexões cifradas (HTTPS), controle de acesso por pessoa no banco de dados, fotos em armazenamento privado com links temporários e a chave da IA
        guardada só no servidor. Se acontecer um incidente de segurança que possa trazer risco a você, avisaremos e comunicaremos a ANPD.
      </p>

      <h2>8. Dados guardados no aparelho</h2>
      <p>
        O app guarda no seu navegador a preferência de tema, o treino em andamento (para não perder nada se a internet cair) e, no modo sem conta, todos
        os dados. Não usamos cookies de publicidade nem de rastreamento.
      </p>
    </Pagina>
  );
}
