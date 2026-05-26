import PageHeader from '../components/ui/PageHeader'

export default function Servicos() {
  return (
    <div className="px-8 py-10 max-w-3xl">
      <PageHeader title="Serviços" subtitle="Fornecedores e prestadores do condomínio" />

      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-8 text-center">
        <div className="text-5xl mb-3">🔧</div>
        <div className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
          Em construção
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          Aqui vai entrar o cadastro de fornecedores e prestadores de serviço do condomínio
          (manutenção, limpeza, dedetização, etc.) com contatos e histórico de chamados.
        </p>
      </div>
    </div>
  )
}
