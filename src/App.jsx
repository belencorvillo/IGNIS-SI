import { useState, useCallback } from 'react'
import TopNav from './components/TopNav'
import LeftPanel from './components/LeftPanel'
import Viewport3D from './components/Viewport3D'
import RightPanel from './components/RightPanel'
import BottomInvestigations from './components/BottomInvestigations'
import DOIModal from './components/DOIModal'

const defaultParams = {
  o2: 21,
  pressure: 14.7,
  gravity: 0.0,
  airflow: 5,
}

function PlaceholderTab({ title, description, icon }) {
  return (
    <div className="flex-1 flex items-center justify-center p-8 grid-bg min-h-[calc(100vh-120px)]">
      <div className="glass-panel glow-cyan p-12 max-w-lg text-center fade-in">
        <div className="text-6xl mb-6">{icon}</div>
        <h2 className="heading-font text-2xl font-bold text-white mb-3">{title}</h2>
        <p className="text-slate-400 mb-6">{description}</p>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-cyan-500/30 text-cyan-400 text-sm">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          Coming in Phase 2
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [activeTab, setActiveTab] = useState(0)
  const [params, setParams] = useState(defaultParams)
  const [activePreset, setActivePreset] = useState('iss')
  const [activePillar, setActivePillar] = useState('All')
  const [viewMode, setViewMode] = useState('chamber')
  const [doiOpen, setDoiOpen] = useState(false)

  const handleSetParams = useCallback((newParams) => {
    setParams(newParams)
  }, [])

  return (
    <div className="min-h-screen bg-[#050811] grid-bg flex flex-col">
      {/* Top Navigation */}
      <TopNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenDOI={() => setDoiOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 pt-[68px]">
        {activeTab === 0 && (
          <div className="fade-in">
            {/* 3-Column Bento Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr_360px] xl:grid-cols-[340px_1fr_380px] gap-3 p-3 min-h-[calc(100vh-280px)]">
              {/* Left Panel: Mission Controls */}
              <div className="glass-panel overflow-hidden flex flex-col max-h-[calc(100vh-180px)]">
                <LeftPanel
                  params={params}
                  setParams={handleSetParams}
                  activePreset={activePreset}
                  setActivePreset={setActivePreset}
                  activePillar={activePillar}
                  setActivePillar={setActivePillar}
                />
              </div>

              {/* Center Panel: 3D Viewport */}
              <div className="glass-panel overflow-hidden flex flex-col min-h-[500px]">
                <Viewport3D
                  params={params}
                  viewMode={viewMode}
                  setViewMode={setViewMode}
                />
              </div>

              {/* Right Panel: Risk & Advisor */}
              <div className="glass-panel overflow-hidden flex flex-col max-h-[calc(100vh-180px)]">
                <RightPanel params={params} />
              </div>
            </div>

            {/* Bottom: Ranked Investigations */}
            <div className="px-3 pb-3">
              <div className="glass-panel p-4">
                <BottomInvestigations
                  params={params}
                  activePillar={activePillar}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 1 && (
          <PlaceholderTab
            title="Multimodal PSI Gallery"
            description="Browse high-resolution imagery, video sequences, and radiometric data from ISS combustion experiments. Filter by flame type, fuel, and hardware rack."
            icon="🖼️"
          />
        )}
        {activeTab === 2 && (
          <PlaceholderTab
            title="Visual Flame Autopsy"
            description="AI-powered visual analysis pipeline for flame structure decomposition, soot distribution mapping, and extinction event classification from PSI imagery."
            icon="🔬"
          />
        )}
        {activeTab === 3 && (
          <PlaceholderTab
            title="Earth Spinoffs"
            description="Explore how microgravity combustion research translates to terrestrial fire safety innovations: improved smoke detectors, clean combustion engines, and advanced fire suppression systems."
            icon="🌍"
          />
        )}
      </main>

      {/* Scope Note Footer */}
      <footer className="border-t border-cyan-500/10 bg-[#050811]/90 backdrop-blur-sm px-4 py-2">
        <p className="text-center text-xs text-slate-500 mono">
          Scope Note: Rocket propulsion and propellants are excluded, as high flow velocities render combustion effectively gravity-independent.
        </p>
      </footer>

      {/* DOI Modal */}
      <DOIModal
        isOpen={doiOpen}
        onClose={() => setDoiOpen(false)}
        params={params}
        activePillar={activePillar}
      />
    </div>
  )
}
