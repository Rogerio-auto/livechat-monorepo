import { BrowserRouter, Routes, Route } from 'react-router-dom'
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
import InviteAcceptPage from './pages/convite'
import { RequireAuth } from './componets/auth/RequireAuth'


function App() {
  return (
    <>
      <BrowserRouter>
      <Routes>
        <Route path='/login' element={<Login/>}/>
        <Route path='/dashboard' element={<RequireAuth><Dash/></RequireAuth>}/>
        <Route path="/funil" element={<RequireAuth><SalesFunnel /></RequireAuth>} />
        <Route path='/clientes' element={<RequireAuth><ClientesPage /></RequireAuth>}/>
        <Route path='/documentos' element={<RequireAuth><DocumentosPage/></RequireAuth>}/>
        <Route path='/calendario' element={<RequireAuth><CalendarioPage/></RequireAuth>}/>
        <Route path='/livechat' element={<RequireAuth><LiveChatPage/></RequireAuth>}/>
        <Route path='/produtos' element={<RequireAuth><ProdutosPage/></RequireAuth>}/>
        <Route path='/configuracoes' element={<RequireAuth><ConfiguracoesPage/></RequireAuth>}/>
        <Route path='/convite' element={<InviteAcceptPage/>}/>
        

      </Routes>
      </BrowserRouter>
    </>
  )
}

export default App
