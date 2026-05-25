import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './components/AuthProvider'
import ProtectedRoute from './components/ProtectedRoute'
import AppShell from './components/AppShell'
import Home from './pages/Home'
import Login from './pages/Login'
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

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
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
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
