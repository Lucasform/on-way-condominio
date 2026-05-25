import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './components/AuthProvider'
import ProtectedRoute from './components/ProtectedRoute'
import AppShell from './components/AppShell'
import Home from './pages/Home'
import Login from './pages/Login'
import MeuPerfil from './pages/MeuPerfil'

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
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
