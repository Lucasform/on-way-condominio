import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { AuthProvider } from './components/AuthProvider'
import { TenantProvider } from './components/TenantProvider'
import { ToastProvider } from './components/ui/Toast'
import { ConfirmProvider } from './components/ui/ConfirmProvider'
import ProtectedRoute from './components/ProtectedRoute'
import { FeatureFlagsProvider } from './contexts/FeatureFlagsContext'
import AppShell from './components/AppShell'
import Logo from './components/Logo'

// Eager: telas críticas de entrada
import Home from './pages/Home'
import Login from './pages/Login'
import Signup from './pages/Signup'
import AuthCallback from './pages/AuthCallback'
import EscolhaPerfil from './pages/EscolhaPerfil'

// Lazy: tudo o mais
const VotarPublico = lazy(() => import('./pages/VotarPublico'))
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
const PessoaHistorico = lazy(() => import('./pages/PessoaHistorico'))
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
const EncomendasEstatisticas = lazy(() => import('./pages/EncomendasEstatisticas'))
const Mural = lazy(() => import('./pages/Mural'))
const MuralNova = lazy(() => import('./pages/MuralNova'))
const Calendario = lazy(() => import('./pages/Calendario'))
const CalendarioForm = lazy(() => import('./pages/CalendarioForm'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Votacoes = lazy(() => import('./pages/Votacoes'))
const VotacaoNova = lazy(() => import('./pages/VotacaoNova'))
const VotacaoDetalhe = lazy(() => import('./pages/VotacaoDetalhe'))
const Assembleias = lazy(() => import('./pages/Assembleias'))
const AssembleiaForm = lazy(() => import('./pages/AssembleiaForm'))
const AssembleiaDetalhe = lazy(() => import('./pages/AssembleiaDetalhe'))
const Templates = lazy(() => import('./pages/Templates'))
const Chamados = lazy(() => import('./pages/Chamados'))
const ChamadoNovo = lazy(() => import('./pages/ChamadoNovo'))
const ChamadoDetalhe = lazy(() => import('./pages/ChamadoDetalhe'))
const Relatorios = lazy(() => import('./pages/Relatorios'))
const EmailsLog = lazy(() => import('./pages/EmailsLog'))
const FilaEnvios = lazy(() => import('./pages/FilaEnvios'))
const Chat = lazy(() => import('./pages/Chat'))
const ChatConversa = lazy(() => import('./pages/ChatConversa'))
const WhatsappConfig = lazy(() => import('./pages/WhatsappConfig'))
const Whatsapp = lazy(() => import('./pages/Whatsapp'))
const Mais = lazy(() => import('./pages/Mais'))
const AuditLog = lazy(() => import('./pages/AuditLog'))
const Servicos = lazy(() => import('./pages/Servicos'))
const Acessos = lazy(() => import('./pages/Acessos'))
const AcessoNovo = lazy(() => import('./pages/AcessoNovo'))
const AcessoDetalhe = lazy(() => import('./pages/AcessoDetalhe'))
const AcessoEvento = lazy(() => import('./pages/AcessoEvento'))
const Classificados = lazy(() => import('./pages/Classificados'))
const ClassificadoNovo = lazy(() => import('./pages/ClassificadoNovo'))
const ClassificadoDetalhe = lazy(() => import('./pages/ClassificadoDetalhe'))
const FeatureFlags = lazy(() => import('./pages/FeatureFlags'))
const Planos = lazy(() => import('./pages/Planos'))
const Solicitacoes = lazy(() => import('./pages/Solicitacoes'))
const SolicitacaoNova = lazy(() => import('./pages/SolicitacaoNova'))
const SolicitacaoDetalhe = lazy(() => import('./pages/SolicitacaoDetalhe'))
const Comunicados = lazy(() => import('./pages/Comunicados'))
const ComunicadoNovo = lazy(() => import('./pages/ComunicadoNovo'))
const ComunicadoDetalhe = lazy(() => import('./pages/ComunicadoDetalhe'))
const Help = lazy(() => import('./pages/Help'))
const Plantao = lazy(() => import('./pages/Plantao'))
const Landing = lazy(() => import('./pages/Landing'))
const CheckoutSucesso = lazy(() => import('./pages/CheckoutSucesso'))

export default function App() {
  return (
    <AuthProvider>
    <TenantProvider>
    <ToastProvider>
    <ConfirmProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/landing" element={<Landing />} />
          <Route path="/checkout/sucesso" element={<CheckoutSucesso />} />
          <Route path="/entrar" element={<EscolhaPerfil />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/esqueci-senha" element={<EsqueciSenha />} />
          <Route path="/atualizar-senha" element={<AtualizarSenha />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/termos" element={<Termos />} />
          <Route path="/privacidade" element={<Privacidade />} />
          <Route path="/votar/:id" element={<VotarPublico />} />
          <Route
            element={
              <ProtectedRoute>
                <FeatureFlagsProvider>
                  <AppShell />
                </FeatureFlagsProvider>
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Home />} />
            <Route path="/mais" element={<Mais />} />
            <Route
              path="/fila-envios"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico', 'subsindico']}>
                  <FilaEnvios />
                </ProtectedRoute>
              }
            />
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
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico', 'subsindico']}>
                  <Unidades />
                </ProtectedRoute>
              }
            />
            <Route
              path="/unidades/novo"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico', 'subsindico']}>
                  <UnidadeForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/unidades/:id"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico', 'subsindico']}>
                  <UnidadeForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pessoas"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico', 'subsindico']}>
                  <Pessoas />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pessoas/novo"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico', 'subsindico']}>
                  <PessoaForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pessoas/:id"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico', 'subsindico']}>
                  <PessoaForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pessoas/:id/historico"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico', 'subsindico']}>
                  <PessoaHistorico />
                </ProtectedRoute>
              }
            />
            <Route
              path="/veiculos"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico', 'subsindico']}>
                  <Veiculos />
                </ProtectedRoute>
              }
            />
            <Route
              path="/veiculos/novo"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico', 'subsindico']}>
                  <VeiculoForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/veiculos/:id"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico', 'subsindico']}>
                  <VeiculoForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pets"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico', 'subsindico']}>
                  <Pets />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pets/novo"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico', 'subsindico']}>
                  <PetForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pets/:id"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico', 'subsindico']}>
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
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico', 'subsindico', 'portaria', 'ronda']}>
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
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico', 'subsindico']}>
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
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico', 'subsindico']}>
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
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico', 'subsindico']}>
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
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico', 'subsindico']}>
                  <RegimentoForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/regimento/:id"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico', 'subsindico']}>
                  <RegimentoForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/painel"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico', 'subsindico']}>
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
              path="/plantao"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico', 'subsindico', 'portaria', 'ronda']}>
                  <Plantao />
                </ProtectedRoute>
              }
            />
            <Route
              path="/encomendas/estatisticas"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico', 'subsindico', 'portaria']}>
                  <EncomendasEstatisticas />
                </ProtectedRoute>
              }
            />
            <Route
              path="/encomendas/novo"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico', 'subsindico', 'portaria']}>
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
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico', 'subsindico']}>
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
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico', 'subsindico']}>
                  <CalendarioForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/calendario/:id"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico', 'subsindico']}>
                  <CalendarioForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico', 'subsindico', 'conselheiro']}>
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
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico', 'subsindico']}>
                  <VotacaoNova />
                </ProtectedRoute>
              }
            />
            <Route
              path="/votacoes/:id"
              element={<ProtectedRoute><VotacaoDetalhe /></ProtectedRoute>}
            />
            <Route
              path="/assembleias"
              element={<ProtectedRoute><Assembleias /></ProtectedRoute>}
            />
            <Route
              path="/assembleias/nova"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico', 'subsindico']}>
                  <AssembleiaForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/assembleias/:id"
              element={<ProtectedRoute><AssembleiaDetalhe /></ProtectedRoute>}
            />
            <Route
              path="/assembleias/:id/editar"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico', 'subsindico']}>
                  <AssembleiaForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/templates"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico', 'subsindico']}>
                  <Templates />
                </ProtectedRoute>
              }
            />
            <Route
              path="/chamados"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico', 'subsindico', 'portaria', 'ronda', 'conselheiro']}>
                  <Chamados />
                </ProtectedRoute>
              }
            />
            <Route
              path="/chamados/novo"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico', 'subsindico', 'portaria', 'ronda']}>
                  <ChamadoNovo />
                </ProtectedRoute>
              }
            />
            <Route
              path="/chamados/:id"
              element={<ProtectedRoute><ChamadoDetalhe /></ProtectedRoute>}
            />
            <Route
              path="/relatorios"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico', 'subsindico']}>
                  <Relatorios />
                </ProtectedRoute>
              }
            />
            <Route
              path="/emails-log"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico', 'subsindico']}>
                  <EmailsLog />
                </ProtectedRoute>
              }
            />
            <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
            <Route path="/chat/:id" element={<ProtectedRoute><ChatConversa /></ProtectedRoute>} />
            <Route
              path="/whatsapp"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico', 'subsindico']}>
                  <Whatsapp />
                </ProtectedRoute>
              }
            />
            <Route
              path="/whatsapp-config"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico', 'subsindico']}>
                  <WhatsappConfig />
                </ProtectedRoute>
              }
            />
            <Route
              path="/auditoria"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico', 'subsindico']}>
                  <AuditLog />
                </ProtectedRoute>
              }
            />
            <Route
              path="/servicos"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico', 'subsindico']}>
                  <Servicos />
                </ProtectedRoute>
              }
            />
            <Route
              path="/acessos"
              element={
                <ProtectedRoute>
                  <Acessos />
                </ProtectedRoute>
              }
            />
            <Route
              path="/acessos/novo"
              element={
                <ProtectedRoute>
                  <AcessoNovo />
                </ProtectedRoute>
              }
            />
            <Route
              path="/acessos/evento"
              element={
                <ProtectedRoute>
                  <AcessoEvento />
                </ProtectedRoute>
              }
            />
            <Route
              path="/acessos/:id"
              element={
                <ProtectedRoute>
                  <AcessoDetalhe />
                </ProtectedRoute>
              }
            />
            <Route
              path="/classificados"
              element={
                <ProtectedRoute>
                  <Classificados />
                </ProtectedRoute>
              }
            />
            <Route
              path="/classificados/novo"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico', 'subsindico']}>
                  <ClassificadoNovo />
                </ProtectedRoute>
              }
            />
            <Route
              path="/classificados/:id"
              element={
                <ProtectedRoute>
                  <ClassificadoDetalhe />
                </ProtectedRoute>
              }
            />
            <Route
              path="/funcionalidades"
              element={
                <ProtectedRoute roles={['admin_onway']}>
                  <FeatureFlags />
                </ProtectedRoute>
              }
            />
            <Route
              path="/planos"
              element={
                <ProtectedRoute>
                  <Planos />
                </ProtectedRoute>
              }
            />
            <Route
              path="/solicitacoes"
              element={<ProtectedRoute><Solicitacoes /></ProtectedRoute>}
            />
            <Route
              path="/solicitacoes/nova"
              element={
                <ProtectedRoute roles={['morador', 'conselheiro']}>
                  <SolicitacaoNova />
                </ProtectedRoute>
              }
            />
            <Route
              path="/solicitacoes/:id"
              element={<ProtectedRoute><SolicitacaoDetalhe /></ProtectedRoute>}
            />
            <Route
              path="/ajuda"
              element={
                <ProtectedRoute>
                  <Help />
                </ProtectedRoute>
              }
            />
            <Route
              path="/comunicados"
              element={
                <ProtectedRoute>
                  <Comunicados />
                </ProtectedRoute>
              }
            />
            <Route
              path="/comunicados/novo"
              element={
                <ProtectedRoute roles={['admin_onway', 'administradora', 'sindico', 'subsindico']}>
                  <ComunicadoNovo />
                </ProtectedRoute>
              }
            />
            <Route
              path="/comunicados/:id"
              element={
                <ProtectedRoute>
                  <ComunicadoDetalhe />
                </ProtectedRoute>
              }
            />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </ConfirmProvider>
    </ToastProvider>
    </TenantProvider>
    </AuthProvider>
  )
}

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400 text-sm">
      Carregando...
    </div>
  )
}

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6 transition-colors">
      <div className="max-w-md text-center">
        <div className="flex justify-center mb-6 opacity-90">
          <Logo size={80} />
        </div>
        <h1 className="text-6xl font-bold text-brand-400 tracking-tight">404</h1>
        <h2 className="mt-3 text-xl font-semibold text-slate-100">Página não encontrada</h2>
        <p className="mt-2 text-sm text-slate-400">
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
            className="px-5 py-2 rounded-md bg-slate-800 border border-slate-700 text-slate-200 font-medium text-sm hover:bg-slate-700 transition"
          >
            ← Voltar
          </button>
        </div>
      </div>
    </div>
  )
}
