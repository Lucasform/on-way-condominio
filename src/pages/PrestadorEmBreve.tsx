import { Link } from 'react-router-dom'
import AuthShell from '../components/AuthShell'

export default function PrestadorEmBreve() {
  return (
    <AuthShell
      title="Acesso de prestador"
      subtitle="Em breve por aqui."
      footer={
        <div className="text-center">
          <Link to="/entrar" className="text-xs text-slate-500 hover:text-brand-700 dark:hover:text-brand-400">
            ← Voltar pra tela inicial
          </Link>
        </div>
      }
    >
      <div className="text-center py-4">
        <div className="text-5xl mb-3">🔧</div>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          O cadastro de prestadores de serviço ainda não está aberto. Estamos finalizando essa parte.
        </p>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Se você é um prestador que atende um condomínio com OnWay, fale com a administração
          do prédio pra ser convidado quando o acesso for liberado.
        </p>
      </div>
    </AuthShell>
  )
}
