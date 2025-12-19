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
import SubscriptionPage from './pages/subscription'
import { ResetPassword } from './pages/reset-password'
import { TarefasPage } from './pages/tarefas'
import { AutomationRulesPage } from './pages/AutomationRulesPage'
import PerfilPage from './pages/perfil'
import AgentDetails from './pages/agents/AgentDetails'
import AgentPlayground from './pages/agents/AgentPlayground'
import { SubscriptionSuccessPage } from './pages/subscription-success'
import { RequireAuth } from './componets/auth/RequireAuth'
import { ThemeProvider } from './context/ThemeContext'
import { SubscriptionProvider } from './context/SubscriptionContext'
import { FeatureGuard } from './componets/auth/FeatureGuard'
import { AppLayout } from './componets/layout/AppLayout'
import { ToastContainer } from './componets/ToastContainer'
import { AdminLayout } from './pages/admin/layout/AdminLayout'
import { AdminDashboard } from './pages/admin/dashboard/AdminDashboard'
import { CompaniesList } from './pages/admin/companies/CompaniesList'
import { CompanyDetails } from './pages/admin/companies/CompanyDetails'
import { CompanyOverview } from './pages/admin/companies-views/CompanyOverview'
import { CompanyAgents } from './pages/admin/companies-views/CompanyAgents'
import { CompanyUsers } from './pages/admin/companies-views/CompanyUsers'
import { CompanyLogs } from './pages/admin/companies-views/CompanyLogs'
import { SystemHealth } from './pages/admin/infrastructure/SystemHealth'
import TemplateList from './pages/admin/Templates/TemplateList'
import TemplateEditor from './pages/admin/Templates/TemplateEditor'
import TemplateTester from './pages/admin/Templates/TemplateTester'
import ToolMonitoring from './pages/admin/Tools/ToolMonitoring'
import ProjectsList from './pages/projects/ProjectsList'
import ProjectKanban from './pages/projects/ProjectKanban'
import ProjectDetails from './pages/projects/ProjectDetails'
import ProjectCreate from './pages/projects/ProjectCreate'
import ProjectTemplates from './pages/projects/ProjectTemplates'
import ProjectTemplateEditor from './pages/projects/ProjectTemplateEditor'


function App() {
  return (
    <ThemeProvider>
      <SubscriptionProvider>
        <BrowserRouter>
        <ToastContainer />
        <Routes>
          <Route path='/' element={<Navigate to="/dashboard" replace />}/>
          <Route path='/login' element={<Login/>}/>
          <Route path='/reset-password' element={<ResetPassword/>}/>
          
          {/* Rota de perfil sem sidebar (tela dedicada) */}
          <Route path='/perfil' element={<RequireAuth><PerfilPage /></RequireAuth>}/>
          <Route path='/subscription/success' element={<RequireAuth><SubscriptionSuccessPage /></RequireAuth>}/>
          
          {/* Rotas com sidebar compartilhada */}
          <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
            <Route path='/dashboard' element={<Dash/>}/>
            <Route path="/funil" element={<SalesFunnel />} />
            <Route path='/clientes' element={<ClientesPage />}/>
            
            <Route path='/tarefas' element={
              <FeatureGuard feature="tasks_module">
                <TarefasPage />
              </FeatureGuard>
            }/>
            
            <Route path='/automacao' element={
              <FeatureGuard feature="automation_module">
                <AutomationRulesPage />
              </FeatureGuard>
            }/>
            
            <Route path='/documentos' element={
              <FeatureGuard feature="document_generation">
                <DocumentosPage/>
              </FeatureGuard>
            }/>
            <Route path='/documentos/:docId' element={
              <FeatureGuard feature="document_generation">
                <DocumentosPage/>
              </FeatureGuard>
            }/>
            
            <Route path='/templates' element={<TemplatesPage/>}/>
            
            <Route path='/calendario' element={
              <FeatureGuard feature="calendar_module">
                <CalendarioPage/>
              </FeatureGuard>
            }/>
            
            <Route path='/livechat' element={<LiveChatPage/>}/>
            <Route path='/livechat/:chatId' element={<LiveChatPage/>}/>
            <Route path='/produtos' element={<ProdutosPage/>}/>
            
            <Route path='/galeria' element={
              <FeatureGuard feature="media_library">
                <GaleriaPage/>
              </FeatureGuard>
            }/>

            {/* Gestão de Projetos */}
            <Route path='/projects' element={<ProjectsList/>}/>
            <Route path='/projects/new' element={<ProjectCreate/>}/>
            <Route path='/projects/:id/edit' element={<ProjectCreate/>}/>
            <Route path='/projects/kanban' element={<ProjectKanban/>}/>
            <Route path='/projects/:id' element={<ProjectDetails/>}/>
            
            <Route path='/configuracoes' element={<ConfiguracoesPage/>}/>
            <Route path='/subscription' element={<SubscriptionPage/>}/>
            
            {/* Monitoramento de Agentes */}
            <Route path='/agents-monitoring' element={<Navigate to="/dashboard?tab=ai-agents" replace />} />
            <Route path='/agents/:agentId' element={<AgentDetails/>}/>
            <Route path='/agents/:agentId/playground' element={<AgentPlayground/>}/>
          </Route>
          
          <Route
            path='/admin'
            element={
              <RequireAuth roles={['SUPER_ADMIN']}>
                <AdminLayout />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path='dashboard' element={<AdminDashboard />} />
            <Route path='companies' element={<CompaniesList />} />
            <Route path='companies/:companyId' element={<CompanyDetails />}>
              <Route index element={<Navigate to='overview' replace />} />
              <Route path='overview' element={<CompanyOverview />} />
              <Route path='agents' element={<CompanyAgents />} />
              <Route path='agents/:agentId' element={<CompanyAgents />} />
              <Route path='users' element={<CompanyUsers />} />
              <Route path='logs' element={<CompanyLogs />} />
            </Route>
            <Route path='infrastructure' element={<SystemHealth />} />
            <Route path='templates' element={<TemplateList />} />
            <Route path='templates/new' element={<TemplateEditor />} />
            <Route path='templates/:id' element={<TemplateEditor />} />
            <Route path="templates/:id/test" element={<TemplateTester />} />
            <Route path='tools' element={<ToolMonitoring />} />
            <Route path='projects/templates' element={<ProjectTemplates />} />
            <Route path='projects/templates/:id' element={<ProjectTemplateEditor />} />
          </Route>
          

        </Routes>
        </BrowserRouter>
      </SubscriptionProvider>
    </ThemeProvider>
  )
}

export default App
