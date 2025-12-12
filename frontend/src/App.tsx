import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Login } from './pages/login'
import { Dash } from './pages/dashboard'
import { SalesFunnel } from './pages/funil-vendas'
import { ClientesPage } from './pages/clientes'
import { PropostaPage } from './pages/orcamento'
import DocumentosPage from './pages/documentos'
import TemplatesPage from './pages/templates'
import { CalendarioPage } from './pages/calendar'
import LiveChatPage from './pages/livechat'
import ProdutosPage from './pages/produtos'
import ConfiguracoesPage from './pages/configuracoes'
import GaleriaPage from './pages/galeria'
import AdminPage from './pages/admin'
import SubscriptionPage from './pages/subscription'
import { ResetPassword } from './pages/reset-password'
import { TarefasPage } from './pages/tarefas'
import { AutomationRulesPage } from './pages/AutomationRulesPage'
import PerfilPage from './pages/perfil'
import { RequireAuth } from './componets/auth/RequireAuth'
import { ThemeProvider } from './context/ThemeContext'
import { AppLayout } from './componets/layout/AppLayout'
import { ToastContainer } from './componets/ToastContainer'


function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
      <ToastContainer />
      <Routes>
        <Route path='/' element={<Navigate to="/dashboard" replace />}/>
        <Route path='/login' element={<Login/>}/>
        <Route path='/reset-password' element={<ResetPassword/>}/>
        
        {/* Rota de perfil sem sidebar (tela dedicada) */}
        <Route path='/perfil' element={<RequireAuth><PerfilPage /></RequireAuth>}/>
        
        {/* Rotas com sidebar compartilhada */}
        <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
          <Route path='/dashboard' element={<Dash/>}/>
          <Route path="/funil" element={<SalesFunnel />} />
          <Route path='/clientes' element={<ClientesPage />}/>
          <Route path='/tarefas' element={<TarefasPage />}/>
          <Route path='/automacao' element={<AutomationRulesPage />}/>
          <Route path='/documentos' element={<DocumentosPage/>}/>
          <Route path='/documentos/:docId' element={<DocumentosPage/>}/>
          <Route path='/templates' element={<TemplatesPage/>}/>
          <Route path='/calendario' element={<CalendarioPage/>}/>
          <Route path='/livechat' element={<LiveChatPage/>}/>
          <Route path='/livechat/:chatId' element={<LiveChatPage/>}/>
          <Route path='/produtos' element={<ProdutosPage/>}/>
          <Route path='/galeria' element={<GaleriaPage/>}/>
          <Route path='/configuracoes' element={<ConfiguracoesPage/>}/>
          <Route path='/admin' element={<AdminPage/>}/>
          <Route path='/subscription' element={<SubscriptionPage/>}/>
        </Route>
        

      </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
