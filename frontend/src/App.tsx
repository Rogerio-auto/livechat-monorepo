import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Login } from './pages/login'
import { Dash } from './pages/dashboard'
import { SalesFunnel } from './pages/funil-vendas'
import { ClientesPage } from './pages/clientes'
import { PropostaPage } from './pages/orcamento'
import DocumentosPage from './pages/documentos'
import { CalendarioPage } from './pages/calendar'
import LiveChatPage from './pages/livechat'
import ProdutosPage from './pages/produtos'
import ConfiguracoesPage from './pages/configuracoes'
import GaleriaPage from './pages/galeria'
import AdminPage from './pages/admin'
import SubscriptionPage from './pages/subscription'
import { ResetPassword } from './pages/reset-password'
import { RequireAuth } from './componets/auth/RequireAuth'
import { ThemeProvider } from './context/ThemeContext'


function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
      <Routes>
        <Route path='/' element={<Navigate to="/dashboard" replace />}/>
        <Route path='/login' element={<Login/>}/>
        <Route path='/reset-password' element={<ResetPassword/>}/>
        <Route path='/dashboard' element={<RequireAuth><Dash/></RequireAuth>}/>
        <Route path="/funil" element={<RequireAuth><SalesFunnel /></RequireAuth>} />
        <Route path='/clientes' element={<RequireAuth><ClientesPage /></RequireAuth>}/>
        <Route path='/documentos' element={<RequireAuth><DocumentosPage/></RequireAuth>}/>
        <Route path='/calendario' element={<RequireAuth><CalendarioPage/></RequireAuth>}/>
        <Route path='/livechat' element={<RequireAuth><LiveChatPage/></RequireAuth>}/>
        <Route path='/produtos' element={<RequireAuth><ProdutosPage/></RequireAuth>}/>
        <Route path='/galeria' element={<RequireAuth><GaleriaPage/></RequireAuth>}/>
        <Route path='/configuracoes' element={<RequireAuth><ConfiguracoesPage/></RequireAuth>}/>
        <Route path='/admin' element={<RequireAuth><AdminPage/></RequireAuth>}/>
        <Route path='/subscription' element={<RequireAuth><SubscriptionPage/></RequireAuth>}/>
        

      </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
