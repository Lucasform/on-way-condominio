import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './components/AuthProvider'
import ProtectedRoute from './components/ProtectedRoute'
import AppShell from './components/AppShell'
import Home from './pages/Home'
import Login from './pages/Login'
import Signup from './pages/Signup'
import EsqueciSenha from './pages/EsqueciSenha'
import AtualizarSenha from './pages/AtualizarSenha'
import AuthCallback from './pages/AuthCallback'
import Termos from './pages/Termos'
import Privacidade from './pages/Privacidade'
import { Link } from 'react-router-dom'
import MeuPerfil from './pages/MeuPerfil'
import Condominios from './pages/Condominios'
import CondominioForm from './pages/CondominioForm'
import Unidades from './pages/Unidades'
import UnidadeForm from './pages/UnidadeForm'
import Pessoas from './pages/Pessoas'
import PessoaForm from './pages/PessoaForm'
import Veiculos from './pages/Veiculos'
import VeiculoForm from './pages/VeiculoForm'
import Pets from './pages/Pets'
import PetForm from './pages/PetForm'
import Ocorrencias from './pages/Ocorrencias'
import OcorrenciaNova from './pages/OcorrenciaNova'
import OcorrenciaDetalhe from './pages/OcorrenciaDetalhe'
import MultaNova from './pages/MultaNova'
import Multas from './pages/Multas'
import MultaDetalhe from './pages/MultaDetalhe'
import UnidadeHistorico from './pages/UnidadeHistorico'
import Regimento from './pages/Regimento'
import RegimentoForm from './pages/RegimentoForm'
import Painel from './pages/Painel'
import Encomendas from './pages/Encomendas'
import EncomendaNova from './pages/EncomendaNova'
import EncomendaDetalhe from './pages/EncomendaDetalhe'
import Mural from './pages/Mural'
import MuralNova from './pages/MuralNova'
import Calendario from './pages/Calendario'
import CalendarioForm from './pages/CalendarioForm'
import Dashboard from './pages/Dashboard'
import Votacoes from './pages/Votacoes'
import VotacaoNova from './pages/VotacaoNova'
import VotacaoDetalhe from './pages/VotacaoDetalhe'
import Chamados from './pages/Chamados'
import ChamadoNovo from './pages/ChamadoNovo'
import ChamadoDetalhe from './pages/ChamadoDetalhe'
import Relatorios from './pages/Relatorios'
import EmailsLog from './pages/EmailsLog'
import Chat from './pages/Chat'
import ChatConversa from './pages/ChatConversa'
import WhatsappConfig from './pages/WhatsappConfig'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
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
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 p-6">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-bold text-brand-700 dark:text-brand-400">404</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Página não encontrada.
        </p>
        <Link to="/" className="mt-4 inline-block text-brand-700 dark:text-brand-400 font-medium hover:underline">
          Voltar pro início
        </Link>
      </div>
    </div>
  )
}
