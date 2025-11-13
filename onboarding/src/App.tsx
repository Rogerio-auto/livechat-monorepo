import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { OnboardingPage } from './pages/onboarding'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<OnboardingPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
