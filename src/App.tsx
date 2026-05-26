import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { AuthProvider } from './components/AuthProvider'
import ProtectedRoute from './components/ProtectedRoute'
import AppShell from './components/AppShell'
import Logo from './components/Logo'

// Eager: telas críticas de entrada
import Home from './pages/Home'
import Login from './pages/Login'
import Signup from './pages/Signup'
import AuthCallback from './pages/AuthCallback'
import EscolhaPerfil from './pages/EscolhaPerfil'
import PrestadorEmBreve from './pages/PrestadorEmBreve'

// Lazy: tudo o mais
const EsqueciSenha = lazy(() => import('./pages/EsqueciSenha'))
const AtualizarSenha = lazy(() => import('./pages/AtualizarSenha'))
const Termos = lazy(() => import('./pages/Termos'))
const Privacidade = lazy(() => import('./pages/Privacidade'))
const MeuPerfil = lazy(() => import('./pages/MeuPerfil'))
const Condominios = lazy(() => import('./pages/Condominios'))
const CondominioForm = lazy(() => import('./pages/CondominioForm'))
const Unidades = lazy(() => import('./pages/Unidades'))
const UnidadeForm = lazy(() => import('./pages/UnidadeForm'))
const Pessoas = lazy(() => import('./pages/Pessoas'))
const PessoaForm = lazy(() => import('./pages/PessoaForm'))
const Veiculos = lazy(() => import('./pages/Veiculos'))
const VeiculoForm = lazy(() => import('./pages/VeiculoForm'))
const Pets = lazy(() => import('./pages/Pets'))
const PetForm = lazy(() => import('./pages/PetForm'))
const Ocorrencias = lazy(() => import('./pages/Ocorrencias'))
const OcorrenciaNova = lazy(() => import('./pages/OcorrenciaNova'))
const OcorrenciaDetalhe = lazy(() => import('./pages/OcorrenciaDetalhe'))
const MultaNova = lazy(() => import('./pages/MultaNova'))
const Multas = lazy(() => import('./pages/Multas'))
const MultaDetalhe = lazy(() => import('./pages/MultaDetalhe'))
const Notificacoes = lazy(() => import('./pages/Notificacoes'))
const NotificacaoNova = lazy(() => import('./pages/NotificacaoNova'))
const NotificacaoDetalhe = lazy(() => import('./pages/NotificacaoDetalhe'))
const UnidadeHistorico = lazy(() => import('./pages/UnidadeHistorico'))
const Regimento = lazy(() => import('./pages/Regimento'))
const RegimentoForm = lazy(() => import('./pages/RegimentoForm'))
const Painel = lazy(() => import('./pages/Painel'))
const Encomendas = lazy(() => import('./pages/Encomendas'))
const EncomendaNova = lazy(() => import('./pages/EncomendaNova'))
const EncomendaDetalhe = lazy(() => import('./pages/EncomendaDetalhe'))
const Mural = lazy(() => import('./pages/Mural'))
const MuralNova = lazy(() => import('./pages/MuralNova'))
const Calendario = lazy(() => import('./pages/Calendario'))
const CalendarioForm = lazy(() => import('./pages/CalendarioForm'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Votacoes = lazy(() => import('./pages/Votacoes'))
const VotacaoNova = lazy(() => import('./pages/VotacaoNova'))
const VotacaoDetalhe = lazy(() => import('./pages/VotacaoDetalhe'))
const Chamados = lazy(() => import('./pages/Chamados'))
const ChamadoNovo = lazy(() => import('./pages/ChamadoNovo'))
const ChamadoDetalhe = lazy(() => import('./pages/ChamadoDetalhe'))
const Relatorios = lazy(() => import('./pages/Relatorios'))
const EmailsLog = lazy(() => import('./pages/EmailsLog'))
const Chat = lazy(() => import('./pages/Chat'))
const ChatConversa = lazy(() => import('./pages/ChatConversa'))
const WhatsappConfig = lazy(() => import('./pages/WhatsappConfig'))
const AuditLog = lazy(() => import('./pages/AuditLog'))
const Servicos = lazy(() => import('./pages/Servicos'))

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/entrar" element={<EscolhaPerfil />} />
          <Route path="/prestador" element={<PrestadorEmBreve />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/esqueci-senha" element={<EsqueciSenha />} />
          <Route path="/atualizar-senha" element={<AtualizarSenha />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/termos" element={<Termos />} />
          <Route path="/privacidade" element={<Privacidade />} />
          <Route
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Home />} />
            <Route path="/meu-perfil" element={<MeuPerfil />} />
            <Route
              path="/condominios"
              element={
                <ProtectedRoute roles={['admin_onway']}>
                  <Condominios />
                </ProtectedRoute>
              }
            />
            <Route
              path="/condominios/novo"
              element={
                <ProtectedRoute roles={['admin_onway']}>
                  <CondominioForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/condominios/:id"
              element={
                <ProtectedRoute roles={['admin_onway']}>
                  <CondominioForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/unidades"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico']}>
                  <Unidades />
                </ProtectedRoute>
              }
            />
            <Route
              path="/unidades/novo"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico']}>
                  <UnidadeForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/unidades/:id"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico']}>
                  <UnidadeForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pessoas"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico']}>
                  <Pessoas />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pessoas/novo"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico']}>
                  <PessoaForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pessoas/:id"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico']}>
                  <PessoaForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/veiculos"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico']}>
                  <Veiculos />
                </ProtectedRoute>
              }
            />
            <Route
              path="/veiculos/novo"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico']}>
                  <VeiculoForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/veiculos/:id"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico']}>
                  <VeiculoForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pets"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico']}>
                  <Pets />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pets/novo"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico']}>
                  <PetForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pets/:id"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico']}>
                  <PetForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ocorrencias"
              element={
                <ProtectedRoute>
                  <Ocorrencias />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ocorrencias/novo"
              element={
                <ProtectedRoute>
                  <OcorrenciaNova />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ocorrencias/:id"
              element={
                <ProtectedRoute>
                  <OcorrenciaDetalhe />
                </ProtectedRoute>
              }
            />
            <Route
              path="/multas/nova"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico']}>
                  <MultaNova />
                </ProtectedRoute>
              }
            />
            <Route
              path="/multas"
              element={
                <ProtectedRoute>
                  <Multas />
                </ProtectedRoute>
              }
            />
            <Route
              path="/multas/:id"
              element={
                <ProtectedRoute>
                  <MultaDetalhe />
                </ProtectedRoute>
              }
            />
            <Route
              path="/notificacoes"
              element={<ProtectedRoute><Notificacoes /></ProtectedRoute>}
            />
            <Route
              path="/notificacoes/nova"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico']}>
                  <NotificacaoNova />
                </ProtectedRoute>
              }
            />
            <Route
              path="/notificacoes/:id"
              element={<ProtectedRoute><NotificacaoDetalhe /></ProtectedRoute>}
            />
            <Route
              path="/unidades/:id/historico"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico']}>
                  <UnidadeHistorico />
                </ProtectedRoute>
              }
            />
            <Route
              path="/regimento"
              element={
                <ProtectedRoute>
                  <Regimento />
                </ProtectedRoute>
              }
            />
            <Route
              path="/regimento/novo"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico']}>
                  <RegimentoForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/regimento/:id"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico']}>
                  <RegimentoForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/painel"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico']}>
                  <Painel />
                </ProtectedRoute>
              }
            />
            <Route
              path="/encomendas"
              element={
                <ProtectedRoute>
                  <Encomendas />
                </ProtectedRoute>
              }
            />
            <Route
              path="/encomendas/novo"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico', 'portaria']}>
                  <EncomendaNova />
                </ProtectedRoute>
              }
            />
            <Route
              path="/encomendas/:id"
              element={
                <ProtectedRoute>
                  <EncomendaDetalhe />
                </ProtectedRoute>
              }
            />
            <Route
              path="/mural"
              element={
                <ProtectedRoute>
                  <Mural />
                </ProtectedRoute>
              }
            />
            <Route
              path="/mural/novo"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico']}>
                  <MuralNova />
                </ProtectedRoute>
              }
            />
            <Route
              path="/calendario"
              element={
                <ProtectedRoute>
                  <Calendario />
                </ProtectedRoute>
              }
            />
            <Route
              path="/calendario/novo"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico']}>
                  <CalendarioForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/calendario/:id"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico']}>
                  <CalendarioForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico']}>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/votacoes"
              element={<ProtectedRoute><Votacoes /></ProtectedRoute>}
            />
            <Route
              path="/votacoes/nova"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico']}>
                  <VotacaoNova />
                </ProtectedRoute>
              }
            />
            <Route
              path="/votacoes/:id"
              element={<ProtectedRoute><VotacaoDetalhe /></ProtectedRoute>}
            />
            <Route
              path="/chamados"
              element={<ProtectedRoute><Chamados /></ProtectedRoute>}
            />
            <Route
              path="/chamados/novo"
              element={<ProtectedRoute><ChamadoNovo /></ProtectedRoute>}
            />
            <Route
              path="/chamados/:id"
              element={<ProtectedRoute><ChamadoDetalhe /></ProtectedRoute>}
            />
            <Route
              path="/relatorios"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico']}>
                  <Relatorios />
                </ProtectedRoute>
              }
            />
            <Route
              path="/emails-log"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico']}>
                  <EmailsLog />
                </ProtectedRoute>
              }
            />
            <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
            <Route path="/chat/:id" element={<ProtectedRoute><ChatConversa /></ProtectedRoute>} />
            <Route
              path="/whatsapp-config"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico']}>
                  <WhatsappConfig />
                </ProtectedRoute>
              }
            />
            <Route
              path="/auditoria"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico']}>
                  <AuditLog />
                </ProtectedRoute>
              }
            />
            <Route
              path="/servicos"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico']}>
                  <Servicos />
                </ProtectedRoute>
              }
            />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 text-sm">
      Carregando...
    </div>
  )
}

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-50 dark:bg-slate-950 p-6 transition-colors">
      <div className="max-w-md text-center">
        <div className="flex justify-center mb-6 opacity-90">
          <Logo size={80} />
        </div>
        <h1 className="text-6xl font-bold text-brand-700 dark:text-brand-400 tracking-tight">404</h1>
        <h2 className="mt-3 text-xl font-semibold text-slate-900 dark:text-slate-100">Página não encontrada</h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Essa rota não existe ou foi movida.
        </p>
        <div className="mt-6 flex gap-3 justify-center">
          <Link
            to="/"
            className="px-5 py-2 rounded-md bg-brand-700 hover:bg-brand-800 text-white font-medium text-sm transition shadow-sm"
          >
            Ir pro início
          </Link>
          <button
            onClick={() => history.back()}
            className="px-5 py-2 rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition"
          >
            ← Voltar
          </button>
        </div>
      </div>
    </div>
  )
}
