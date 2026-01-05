import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { CadastroPage } from './pages/cadastro'
import ConvitePage from './pages/convite'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/cadastro" element={<CadastroPage />} />
        <Route path="/precos" element={<CadastroPage />} />
        <Route path="/convite" element={<ConvitePage />} />
        <Route path="/" element={<Navigate to="/precos" replace />} />
        <Route path="*" element={<Navigate to="/precos" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
