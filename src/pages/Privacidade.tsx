import AuthShell from '../components/AuthShell'

export default function Privacidade() {
  return (
    <AuthShell title="Política de Privacidade" subtitle="Versão 1.0 — em conformidade com a LGPD (Lei 13.709/2018)">
      <div className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 space-y-4">
        <section>
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">1. Dados coletados</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>Identificação: nome, CPF, data de nascimento, foto.</li>
            <li>Contato: e-mail, telefone.</li>
            <li>Vínculo condominial: unidade, bloco, tipo de relação.</li>
            <li>Uso da plataforma: visitas, encomendas, ocorrências, multas, chamados, mensagens.</li>
            <li>Técnicos: IP, user-agent, logs de auditoria.</li>
          </ul>
        </section>
        <section>
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">2. Finalidade</h3>
          <p>
            Operar a gestão do condomínio: controle de acesso, comunicação, cobranças, segurança e atendimento
            a obrigações legais (LGPD, código civil, convenção condominial).
          </p>
        </section>
        <section>
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">3. Base legal</h3>
          <p>
            Execução de contrato (art. 7º, V LGPD), legítimo interesse do condomínio (art. 7º, IX) e
            consentimento do titular nos casos aplicáveis (art. 7º, I).
          </p>
        </section>
        <section>
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">4. Compartilhamento</h3>
          <p>
            Dados são compartilhados apenas com a administradora contratada e com prestadores de
            infraestrutura (Supabase, Vercel, Resend) sob contrato de operador. Não vendemos dados.
          </p>
        </section>
        <section>
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">5. Direitos do titular</h3>
          <p>
            Você pode, a qualquer momento, em "Meu perfil":
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Acessar e atualizar seus dados.</li>
            <li>Baixar uma cópia (formato JSON).</li>
            <li>Solicitar a exclusão da conta.</li>
          </ul>
        </section>
        <section>
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">6. Retenção</h3>
          <p>
            Dados são mantidos enquanto durar o vínculo com o condomínio e por até 5 anos após o encerramento
            para atender obrigações legais (prestação de contas, defesa em ações judiciais).
          </p>
        </section>
        <section>
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">7. Encarregado (DPO)</h3>
          <p>
            Contato para questões de privacidade: <a href="mailto:dpo@onwaytech.com.br" className="text-brand-700 dark:text-brand-400 hover:underline">dpo@onwaytech.com.br</a>.
          </p>
        </section>
      </div>
    </AuthShell>
  )
}
