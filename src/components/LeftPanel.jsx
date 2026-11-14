import { useRef, useCallback } from 'react';
import { Rocket, Sliders, Shield } from 'lucide-react';
import { missionPresets } from '../data/investigations';

// ---------------------------------------------------------------------------
// Smooth-animation helper: lerps current params → target over ~400ms
// ---------------------------------------------------------------------------
function animateParams(current, target, setParams, setActivePreset, presetId) {
  const duration = 400;
  const start = performance.now();
  const from = { ...current };

  function tick(now) {
    const t = Math.min((now - start) / duration, 1);
    // ease-out cubic
    const e = 1 - Math.pow(1 - t, 3);

    setParams({
      o2: +(from.o2 + (target.o2 - from.o2) * e).toFixed(2),
      pressure: +(from.pressure + (target.pressure - from.pressure) * e).toFixed(2),
      gravity: +(from.gravity + (target.gravity - from.gravity) * e).toFixed(3),
      airflow: +(from.airflow + (target.airflow - from.airflow) * e).toFixed(1),
    });

    if (t < 1) requestAnimationFrame(tick);
  }

  setActivePreset(presetId);
  requestAnimationFrame(tick);
}

// ---------------------------------------------------------------------------
// Pillar pill definitions
// ---------------------------------------------------------------------------
const PILLARS = [
  { id: 'All', label: 'All Pillars' },
  { id: 'Prevention', label: 'Prevention (Materials)' },
  { id: 'Detection', label: 'Detection (Smoke/Aerosols)' },
  { id: 'Suppression', label: 'Suppression (Extinguishment)' },
];

// ---------------------------------------------------------------------------
// Gravity tick marks
// ---------------------------------------------------------------------------
const GRAVITY_TICKS = [
  { value: 0, label: '0g ISS' },
  { value: 0.16, label: '0.16g Moon' },
  { value: 0.38, label: '0.38g Mars' },
  { value: 1, label: '1g Earth' },
];

// ---------------------------------------------------------------------------
// LeftPanel Component
// ---------------------------------------------------------------------------
export default function LeftPanel({
  params,
  setParams,
  activePreset,
  setActivePreset,
  activePillar,
  setActivePillar,
}) {
  const paramsRef = useRef(params);
  paramsRef.current = params;

  // ------- Slider change handler -------
  const handleSlider = useCallback(
    (key, value) => {
      setParams({ ...paramsRef.current, [key]: Number(value) });
      setActivePreset(null);
    },
    [setParams, setActivePreset],
  );

  return (
    <aside className="glass-panel p-4 flex flex-col gap-5 overflow-y-auto max-h-[calc(100vh-4rem)] w-full">
      {/* ============================================================= */}
      {/* SECTION 1 — Quick Mission Presets                              */}
      {/* ============================================================= */}
      <section>
        <h2 className="heading-font flex items-center gap-2 text-cyan-400 text-sm font-semibold uppercase tracking-wider mb-3">
          <Rocket size={16} /> Quick Mission Presets
        </h2>

        <div className="flex flex-col gap-2">
          {missionPresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`preset-card glass-panel-sm p-3 text-left cursor-pointer ${
                activePreset === preset.id ? 'active' : ''
              }`}
              onClick={() =>
                animateParams(
                  paramsRef.current,
                  {
                    o2: preset.o2,
                    pressure: preset.pressure,
                    gravity: preset.gravity,
                    airflow: preset.airflow,
                  },
                  setParams,
                  setActivePreset,
                  preset.id,
                )
              }
            >
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-200 text-sm">{preset.name}</span>
                {preset.badge && (
                  <span className="text-amber-400 text-[10px] font-semibold bg-amber-400/10 border border-amber-400/30 rounded px-1.5 py-0.5 leading-none">
                    {preset.badge}
                  </span>
                )}
              </div>

              <p className="mono text-xs text-slate-400 mt-1">
                {preset.o2}% O₂ | {preset.pressure} psi | {preset.gravity.toFixed(2)}g |{' '}
                {preset.airflow} cm/s
              </p>

              {preset.id === 'eva' && (
                <p className="text-[10px] text-amber-400/80 mt-1 italic">
                  Actual 100% O₂ — capped at 85% PSI experimental limit
                </p>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* ============================================================= */}
      {/* SECTION 2 — Parametric Sliders                                 */}
      {/* ============================================================= */}
      <section>
        <h2 className="heading-font flex items-center gap-2 text-cyan-400 text-sm font-semibold uppercase tracking-wider mb-3">
          <Sliders size={16} /> Parametric Sliders
        </h2>

        <div className="flex flex-col gap-4">
          {/* ---- Oxygen ---- */}
          <div>
            <div className="flex justify-between items-baseline mb-1">
              <label className="text-slate-300 text-xs">Oxygen (% O₂)</label>
              <span className="mono text-cyan-400 text-xs">{params.o2}%</span>
            </div>
            <input
              type="range"
              min={21}
              max={85}
              step={1}
              value={params.o2}
              onChange={(e) => handleSlider('o2', e.target.value)}
            />
            {/* marker at 30% */}
            <div className="relative h-4 mt-0.5">
              <div
                className="absolute text-[9px] text-slate-500 -translate-x-1/2"
                style={{ left: `${((30 - 21) / (85 - 21)) * 100}%` }}
              >
                <span className="block w-px h-1.5 bg-slate-500 mx-auto mb-0.5" />
                Lunar Habitat Target
              </div>
            </div>
          </div>

          {/* ---- Cabin Pressure ---- */}
          <div>
            <div className="flex justify-between items-baseline mb-1">
              <label className="text-slate-300 text-xs">Cabin Pressure (psi)</label>
              <span className="mono text-cyan-400 text-xs">{params.pressure} psi</span>
            </div>
            <input
              type="range"
              min={4.3}
              max={14.7}
              step={0.1}
              value={params.pressure}
              onChange={(e) => handleSlider('pressure', e.target.value)}
            />
            <div className="relative h-4 mt-0.5">
              <div
                className="absolute text-[9px] text-slate-500 -translate-x-1/2"
                style={{ left: `${((10.2 - 4.3) / (14.7 - 4.3)) * 100}%` }}
              >
                <span className="block w-px h-1.5 bg-slate-500 mx-auto mb-0.5" />
                10.2 psi
              </div>
            </div>
          </div>

          {/* ---- Gravity ---- */}
          <div>
            <div className="flex justify-between items-baseline mb-1">
              <label className="text-slate-300 text-xs">Gravity Level (g)</label>
              <span className="mono text-cyan-400 text-xs">{params.gravity.toFixed(2)}g</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={params.gravity}
              onChange={(e) => handleSlider('gravity', e.target.value)}
            />
            <div className="relative h-4 mt-0.5 flex justify-between">
              {GRAVITY_TICKS.map((tick) => (
                <div
                  key={tick.value}
                  className="absolute text-[9px] text-slate-500 -translate-x-1/2"
                  style={{ left: `${tick.value * 100}%` }}
                >
                  <span className="block w-px h-1.5 bg-slate-500 mx-auto mb-0.5" />
                  {tick.label}
                </div>
              ))}
            </div>
          </div>

          {/* ---- Airflow ---- */}
          <div>
            <div className="flex justify-between items-baseline mb-1">
              <label className="text-slate-300 text-xs">Airflow (cm/s)</label>
              <span className="mono text-cyan-400 text-xs">{params.airflow} cm/s</span>
            </div>
            <input
              type="range"
              min={0}
              max={30}
              step={1}
              value={params.airflow}
              onChange={(e) => handleSlider('airflow', e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* ============================================================= */}
      {/* SECTION 3 — Safety Pillar Filter                               */}
      {/* ============================================================= */}
      <section>
        <h2 className="heading-font flex items-center gap-2 text-cyan-400 text-sm font-semibold uppercase tracking-wider mb-3">
          <Shield size={16} /> Safety Pillar Filter
        </h2>

        <div className="flex flex-wrap gap-2">
          {PILLARS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`pillar-pill text-xs px-3 py-1.5 rounded-full border border-slate-600/50 text-slate-400 cursor-pointer ${
                activePillar === p.id ? 'active' : ''
              }`}
              onClick={() => setActivePillar(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </section>
    </aside>
  );
}
