import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import Home from './pages/Home'
import ProjectDetail from './pages/ProjectDetail'
import AnalyzePage from './pages/AnalyzePage'
import Geodata from './pages/Geodata'
import ZenTest from './pages/ZenTest'
import { LayoutDashboard, ScanSearch, Map, Zap } from 'lucide-react'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-100">
        <nav className="bg-white border-b border-gray-200 px-6 py-0 flex items-center gap-6">
          <div className="flex items-center gap-2 py-3 mr-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">Z</span>
            </div>
            <span className="font-semibold text-gray-800 text-sm whitespace-nowrap">ZenForce</span>
          </div>

          <NavLink to="/" end
            className={({ isActive }) =>
              `flex items-center gap-1.5 text-sm py-3.5 border-b-2 transition-colors px-1
              ${isActive ? 'border-blue-600 text-blue-600 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <LayoutDashboard className="w-4 h-4" />
            Proyectos
          </NavLink>

          <NavLink to="/geodata"
            className={({ isActive }) =>
              `flex items-center gap-1.5 text-sm py-3.5 border-b-2 transition-colors px-1
              ${isActive ? 'border-blue-600 text-blue-600 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <Map className="w-4 h-4" />
            Geodata
          </NavLink>

          <NavLink to="/zentest"
            className={({ isActive }) =>
              `flex items-center gap-1.5 text-sm py-3.5 border-b-2 transition-colors px-1
              ${isActive ? 'border-blue-600 text-blue-600 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <Zap className="w-4 h-4" />
            ZenTest
          </NavLink>

          <NavLink to="/analyze"
            className={({ isActive }) =>
              `flex items-center gap-1.5 text-sm py-3.5 border-b-2 transition-colors px-1
              ${isActive ? 'border-blue-600 text-blue-600 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <ScanSearch className="w-4 h-4" />
            ForceInsights
          </NavLink>

          <span className="ml-auto text-xs text-gray-400 hidden sm:block">Tau Sigma · Minigranjas Solares</span>
        </nav>

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/geodata" element={<Geodata />} />
          <Route path="/zentest" element={<ZenTest />} />
          <Route path="/analyze" element={<AnalyzePage />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
