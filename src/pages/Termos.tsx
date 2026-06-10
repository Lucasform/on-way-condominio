import AuthShell from '../components/AuthShell'

export default function Termos() {
  return (
    <AuthShell title="Termos de Uso" subtitle="Versão 1.0 — vigente desde 26/05/2026">
      <div className="prose prose-sm dark:prose-invert max-w-none text-slate-300 space-y-4">
        <section>
          <h3 className="font-semibold text-slate-100">1. Objeto</h3>
          <p>
            O OnWay Condomínio é uma plataforma de gestão condominial oferecida aos condomínios contratantes
            e disponibilizada aos respectivos moradores, funcionários, síndicos e administradoras.
          </p>
        </section>
        <section>
          <h3 className="font-semibold text-slate-100">2. Uso da conta</h3>
          <p>
            A conta é pessoal e intransferível. O usuário é responsável por manter a confidencialidade
            de suas credenciais e por qualquer atividade realizada com elas.
          </p>
        </section>
        <section>
          <h3 className="font-semibold text-slate-100">3. Conduta</h3>
          <p>
            É vedado utilizar a plataforma para qualquer finalidade ilegal, abusiva, ofensiva ou que viole
            direitos de terceiros. Conteúdo postado em murais, chats ou ocorrências é de responsabilidade
            do autor.
          </p>
        </section>
        <section>
          <h3 className="font-semibold text-slate-100">4. Encerramento</h3>
          <p>
            O usuário pode solicitar a exclusão de sua conta a qualquer momento via "Meu perfil" → "Solicitar
            exclusão". O contratante (condomínio) pode revogar acessos a qualquer tempo.
          </p>
        </section>
        <section>
          <h3 className="font-semibold text-slate-100">5. Limitação de responsabilidade</h3>
          <p>
            A plataforma é fornecida "como está". O OnWay não se responsabiliza por decisões tomadas pelo
            condomínio com base em dados aqui inseridos.
          </p>
        </section>
        <section>
          <h3 className="font-semibold text-slate-100">6. Foro</h3>
          <p>Fica eleito o foro da comarca do condomínio contratante para dirimir eventuais litígios.</p>
        </section>
      </div>
    </AuthShell>
  )
}
