import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import Home from './pages/Home'
import ProjectDetail from './pages/ProjectDetail'
import AnalyzePage from './pages/AnalyzePage'
import { LayoutDashboard, ScanSearch } from 'lucide-react'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-brand-light">
        <nav className="bg-white border-b border-gray-200 px-6 py-0 flex items-center gap-6">
          <div className="flex items-center gap-2 py-3 mr-2">
            <img src="/logo.png" alt="Zentrack logo" className="h-8 w-auto flex-shrink-0" />
            <span className="font-semibold text-brand-dark text-sm whitespace-nowrap">POT Analítica</span>
          </div>

          <NavLink to="/" end
            className={({ isActive }) =>
              `flex items-center gap-1.5 text-sm py-3.5 border-b-2 transition-colors px-1
              ${isActive ? 'border-brand text-brand font-medium' : 'border-transparent text-brand-gray hover:text-brand-dark'}`}>
            <LayoutDashboard className="w-4 h-4" />
            Proyectos
          </NavLink>

          <NavLink to="/analyze"
            className={({ isActive }) =>
              `flex items-center gap-1.5 text-sm py-3.5 border-b-2 transition-colors px-1
              ${isActive ? 'border-brand text-brand font-medium' : 'border-transparent text-brand-gray hover:text-brand-dark'}`}>
            <ScanSearch className="w-4 h-4" />
            Analizar archivo
          </NavLink>

          <span className="ml-auto text-xs text-brand-gray hidden sm:block">Tau Sigma · Minigranjas Solares</span>
        </nav>

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/analyze" element={<AnalyzePage />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
