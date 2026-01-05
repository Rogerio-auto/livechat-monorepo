import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Login } from './pages/login'
import { Dash } from './pages/dashboard'
import { SalesFunnel } from './pages/funil-vendas'
import { ClientesPage } from './pages/clientes'
import ClienteCreate from './pages/clientes/ClienteCreate'
import ClienteEdit from './pages/clientes/ClienteEdit'
import ClienteTaskCreate from './pages/clientes/ClienteTaskCreate'
import { PropostaPage } from './pages/orcamento'
import DocumentosPage from './pages/documentos'
import TemplatesPage from './pages/templates'
import { CalendarioPage } from './pages/calendar'
import EventCreate from './pages/calendar/EventCreate'
import EventEdit from './pages/calendar/EventEdit'
import EventView from './pages/calendar/EventView'
import LiveChatPage from './pages/livechat'
import ProdutosPage from './pages/produtos'
import ProductCreate from './pages/produtos/ProductCreate'
import ProductEdit from './pages/produtos/ProductEdit'
import ProductView from './pages/produtos/ProductView'
import ConfiguracoesPage from './pages/configuracoes'
import SettingsLayout from './pages/configuracoes/SettingsLayout'
import EmpresaPage from './pages/configuracoes/EmpresaPage'
import PerfilPageSettings from './pages/configuracoes/PerfilPage'
import InboxesPage from './pages/configuracoes/InboxesPage'
import IntegracoesPage from './pages/configuracoes/IntegracoesPage'
import BillingPage from './pages/configuracoes/BillingPage'
import IAPage from './pages/configuracoes/IAPage'
import AgentEditPage from './pages/configuracoes/AgentEditPage'
import KnowledgeBasePage from './pages/configuracoes/KnowledgeBasePage'
import ColaboradoresPage from './pages/configuracoes/ColaboradoresPage'
import DepartamentosPage from './pages/configuracoes/DepartamentosPage'
import TimesPage from './pages/configuracoes/TimesPage'
import CalendariosPage from './pages/configuracoes/CalendariosPage'
import PermissoesCalendarioPage from './pages/configuracoes/PermissoesCalendarioPage'
import GaleriaPage from './pages/galeria'
import SubscriptionPage from './pages/subscription'
import { ResetPassword } from './pages/reset-password'
import { TarefasPage } from './pages/tarefas'
import TaskCreate from './pages/tarefas/TaskCreate'
import TaskEdit from './pages/tarefas/TaskEdit'
import { AutomationRulesPage } from './pages/AutomationRulesPage'
import PerfilPage from './pages/perfil'
import AgentDetails from './pages/agents/AgentDetails'
import AgentPlayground from './pages/agents/AgentPlayground'
import { CadastroPage } from './pages/cadastro'
import { SubscriptionSuccessPage } from './pages/subscription-success'
import { RequireAuth } from './componets/auth/RequireAuth'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import { SubscriptionProvider } from './context/SubscriptionContext'
import { CadastroProvider } from './context/CadastroContext'
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
import NotificationsPage from './components/notifications/NotificationsPage'
import NotificationPreferencesPage from './components/notifications/NotificationPreferences'


function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SubscriptionProvider>
          <CadastroProvider>
            <BrowserRouter>
          <ToastContainer />
          <Routes>
          <Route path='/' element={<Navigate to="/dashboard" replace />}/>
          <Route path='/login' element={<Login/>}/>
          <Route path='/reset-password' element={<ResetPassword/>}/>
          <Route path='/cadastro' element={<RequireAuth><CadastroPage /></RequireAuth>}/>
          
          {/* Rota de perfil sem sidebar (tela dedicada) */}
          <Route path='/perfil' element={<RequireAuth><PerfilPage /></RequireAuth>}/>
          <Route path='/subscription/success' element={<RequireAuth><SubscriptionSuccessPage /></RequireAuth>}/>
          
          {/* Rotas com sidebar compartilhada */}
          <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
            <Route path='/dashboard' element={<Dash/>}/>
            <Route path="/funil" element={<SalesFunnel />} />
            <Route path='/clientes' element={<ClientesPage />}/>
            <Route path='/clientes/novo' element={<ClienteCreate />}/>
            <Route path='/clientes/:id/editar' element={<ClienteEdit />}/>
            <Route path='/clientes/:id/tarefas/nova' element={<ClienteTaskCreate />}/>
            
            <Route path='/tarefas' element={
              <FeatureGuard feature="tasks_module">
                <TarefasPage />
              </FeatureGuard>
            }/>
            <Route path='/tarefas/nova' element={
              <FeatureGuard feature="tasks_module">
                <TaskCreate />
              </FeatureGuard>
            }/>
            <Route path='/tarefas/:id/editar' element={
              <FeatureGuard feature="tasks_module">
                <TaskEdit />
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
            <Route path='/calendario/novo' element={
              <FeatureGuard feature="calendar_module">
                <EventCreate/>
              </FeatureGuard>
            }/>
            <Route path='/calendario/:id' element={
              <FeatureGuard feature="calendar_module">
                <EventView/>
              </FeatureGuard>
            }/>
            <Route path='/calendario/:id/editar' element={
              <FeatureGuard feature="calendar_module">
                <EventEdit/>
              </FeatureGuard>
            }/>
            
            <Route path='/livechat' element={<LiveChatPage/>}/>
            <Route path='/livechat/:chatId' element={<LiveChatPage/>}/>
            <Route path='/livechat/flows' element={<LiveChatPage/>}/>
            <Route path='/livechat/flows/:flowId' element={<LiveChatPage/>}/>
            <Route path='/produtos' element={<ProdutosPage/>}/>

            <Route path='/produtos/novo' element={<ProductCreate/>}/>
            <Route path='/produtos/:id' element={<ProductView/>}/>
            <Route path='/produtos/:id/editar' element={<ProductEdit/>}/>
            
            <Route path='/galeria' element={<GaleriaPage/>}/>

            {/* Gestão de Projetos */}
            <Route path='/projects' element={<ProjectsList/>}/>
            <Route path='/projects/new' element={<ProjectCreate/>}/>
            <Route path='/projects/:id/edit' element={<ProjectCreate/>}/>
            <Route path='/projects/kanban' element={<ProjectKanban/>}/>
            <Route path='/projects/:id' element={<ProjectDetails/>}/>
            
            <Route path='/configuracoes' element={<SettingsLayout />}>
              <Route index element={<Navigate to="empresa" replace />} />
              <Route path="empresa" element={<EmpresaPage />} />
              <Route path="perfil" element={<PerfilPageSettings />} />
              <Route path="canais" element={<InboxesPage />} />
              <Route path="integracoes" element={<IntegracoesPage />} />
              <Route path="faturamento" element={<BillingPage />} />
              <Route path="ia" element={<IAPage />} />
              <Route path="ia/novo" element={<AgentEditPage />} />
              <Route path="ia/:agentId" element={<AgentEditPage />} />
              <Route path="base-conhecimento" element={<KnowledgeBasePage />} />
              <Route path="colaboradores" element={<ColaboradoresPage />} />
              <Route path="departamentos" element={<DepartamentosPage />} />
              <Route path="times" element={<TimesPage />} />
              <Route path="calendarios" element={<CalendariosPage />} />
              <Route path="permissoes-calendario" element={<PermissoesCalendarioPage />} />
              <Route path="notificacoes" element={<NotificationPreferencesPage />} />
            </Route>
            <Route path='/subscription' element={<SubscriptionPage/>}/>
            
            {/* Notificações */}
            <Route path='/notifications' element={<NotificationsPage />} />

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
        </CadastroProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
