import { BrowserRouter, Route, Routes } from "react-router-dom";

import { LayoutShell } from "./components/layout/LayoutShell";
import Home from "./pages/Home";
import Pricing from "./pages/Pricing";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Demo from "./pages/Demo";
import ThankYou from "./pages/ThankYou";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import LGPD from "./pages/LGPD";
import NotFound from "./pages/NotFound";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<LayoutShell />}>
          <Route index element={<Home />} />
          <Route path="precos" element={<Pricing />} />
          <Route path="sobre" element={<About />} />
          <Route path="contato" element={<Contact />} />
          <Route path="demo" element={<Demo />} />
          <Route path="obrigado" element={<ThankYou />} />
          <Route path="privacidade" element={<Privacy />} />
          <Route path="termos" element={<Terms />} />
          <Route path="lgpd" element={<LGPD />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
