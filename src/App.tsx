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
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
