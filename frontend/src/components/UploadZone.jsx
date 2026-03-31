import React, { useState } from 'react';
import { UploadCloud, File, Zap, Server, Folder, ChevronDown, Check } from 'lucide-react';
import FluidSimulation from './FluidSimulation';
import logo from '../assets/logo.png';

const REGIONS = [
  { code: 'IND', label: 'India', intensity: '708 g/kWh', flag: '🇮🇳' },
  { code: 'USA', label: 'United States', intensity: '386 g/kWh', flag: '🇺🇸' },
  { code: 'DEU', label: 'Germany', intensity: '400 g/kWh', flag: '🇩🇪' },
  { code: 'FRA', label: 'France', intensity: '85 g/kWh', flag: '🇫🇷' },
  { code: 'JPN', label: 'Japan', intensity: '450 g/kWh', flag: '🇯🇵' },
];

function RegionDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const selected = REGIONS.find(r => r.code === value) || REGIONS[0];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-3 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-purple-500/40 transition-all text-sm text-gray-200 group"
      >
        <span className="flex items-center gap-3">
          <span className="text-lg leading-none">{selected.flag}</span>
          <span className="font-medium">{selected.label}</span>
          <span className="text-xs font-mono text-gray-500 bg-white/5 px-2 py-0.5 rounded-md">{selected.code}</span>
        </span>
        <ChevronDown
          size={14}
          className={`text-gray-500 group-hover:text-purple-400 transition-all duration-200 ${open ? 'rotate-180 text-purple-400' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute z-50 left-0 right-0 mt-2 rounded-xl border border-white/10 bg-[#0d0d0d] shadow-[0_8px_32px_rgba(0,0,0,0.6)] overflow-hidden animate-fade-in">
          {REGIONS.map(r => (
            <button
              key={r.code}
              type="button"
              onClick={() => { onChange(r.code); setOpen(false); }}
              className={`w-full flex items-center justify-between px-4 py-3 text-sm transition-all hover:bg-purple-500/10 ${
                r.code === value ? 'bg-purple-500/10 text-purple-300' : 'text-gray-300'
              }`}
            >
              <span className="flex items-center gap-3">
                <span className="text-base leading-none">{r.flag}</span>
                <span className="font-medium">{r.label}</span>
                <span className="text-xs font-mono text-gray-600">{r.code}</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="text-xs font-mono text-gray-600">{r.intensity}</span>
                {r.code === value && <Check size={12} className="text-purple-400" />}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function UploadZone({ onAnalyze, loading }) {
  const [notebook, setNotebook] = useState(null);
  const [datasets, setDatasets] = useState([]);
  const [region, setRegion] = useState('IND');
  const [runLive, setRunLive] = useState(true);

  const handleDropNB = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) setNotebook(e.dataTransfer.files[0]);
  };

  const handleDropDS = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) setDatasets(Array.from(e.dataTransfer.files));
  };

  const submit = () => {
    if (!notebook) return alert('Please select a Jupyter Notebook (.ipynb)');
    onAnalyze({ notebook, dataset: datasets, region, runLive });
  };

  // ── Branded Loading Screen ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#030303]">
        {/* Background fluid */}
        <div className="absolute inset-0 opacity-40">
          <FluidSimulation curlStrength={50} splatRadius={0.4} />
        </div>

        {/* Loading content */}
        <div className="relative z-10 flex flex-col items-center justify-center text-center p-8 max-w-2xl mx-auto animate-fade-in">
          {/* Logo with rings */}
          <div className="w-32 h-32 mb-10 relative flex items-center justify-center">
            <div className="absolute inset-0 border border-white/5 rounded-full animate-pulse-slow"></div>
            <div
              className="absolute inset-[-8px] border border-purple-500/20 border-t-transparent rounded-full animate-spin"
              style={{ animationDuration: '3s' }}
            ></div>
            <div
              className="absolute inset-[-16px] border border-green-500/10 border-b-transparent rounded-full animate-spin"
              style={{ animationDuration: '5s', animationDirection: 'reverse' }}
            ></div>
            <div className="relative w-24 h-24">
              <div className="absolute inset-0 bg-green-500/20 rounded-full blur-xl animate-pulse-slow"></div>
              <img
                src={logo}
                alt="GreenTrace"
                className="relative w-full h-full object-contain drop-shadow-[0_0_20px_rgba(34,197,94,0.4)]"
              />
            </div>
          </div>

          <h2 className="text-4xl md:text-5xl font-syne font-bold text-white mb-6 tracking-tighter">
            Calculating{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-purple-400">
              Compute
            </span>
          </h2>
          <div className="text-gray-400 space-y-3 font-mono text-sm max-w-sm mx-auto">
            <p className="animate-pulse">Building abstract syntax tree...</p>
            <p className="opacity-70 animate-pulse">Tracing execution &amp; energy draw...</p>
            <p className="opacity-40 animate-pulse text-purple-400 font-bold">
              Querying AI for optimizations...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Main Upload Form ─────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-3xl mx-auto animate-slide-up flex flex-col justify-center min-h-[60vh]">
      <div className="mb-10">
        <h2 className="text-4xl md:text-5xl font-syne font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-400 via-purple-400 to-purple-600 tracking-tighter">
          Analysis Configuration
        </h2>
        <p className="text-gray-500 font-mono text-xs mt-4 uppercase tracking-widest">Upload Source Files</p>
        <div className="mt-5 border-l-2 border-purple-500/50 pl-4 py-1">
          <p className="text-gray-300 font-sans text-sm leading-relaxed max-w-2xl">
            <strong className="text-purple-300 tracking-wider text-xs uppercase font-mono mr-2">Prerequisite:</strong>
            Ensure your Jupyter Notebook runs flawlessly start-to-finish on your local environment before uploading.
            Notebooks containing syntax errors or fatal crashes midway will yield incomplete infrastructure profiles
            and inaccurate carbon measurements.
          </p>
        </div>
      </div>

      {/* File Upload Boxes */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* Notebook */}
        <div
          className={`relative border rounded-2xl p-10 flex flex-col items-center justify-center transition-all cursor-pointer ${
            notebook ? 'border-purple-500/60 bg-purple-500/5' : 'border-white/5 bg-white/[0.02] hover:border-white/20'
          }`}
          onDragOver={e => e.preventDefault()}
          onDrop={handleDropNB}
          onClick={() => document.getElementById('nb-upload')?.click()}
        >
          <input
            type="file"
            id="nb-upload"
            accept=".ipynb"
            className="hidden"
            onChange={e => e.target.files?.[0] && setNotebook(e.target.files[0])}
          />
          {notebook ? (
            <div className="text-center animate-fade-in">
              <File className="text-purple-400 mx-auto mb-3" strokeWidth={1} size={40} />
              <p className="font-medium text-gray-200 text-sm">{notebook.name}</p>
              <p className="text-xs text-gray-500 mt-2 font-mono">{(notebook.size / 1024).toFixed(1)} KB</p>
            </div>
          ) : (
            <div className="text-center">
              <UploadCloud className="text-gray-600 mx-auto mb-3" strokeWidth={1} size={40} />
              <p className="font-medium text-gray-300 text-sm">Jupyter Notebook</p>
              <p className="text-xs text-gray-500 mt-2 font-mono">.ipynb</p>
            </div>
          )}
        </div>

        {/* Dataset */}
        <div
          className={`relative border rounded-2xl p-10 flex flex-col items-center justify-center transition-all cursor-pointer ${
            datasets.length > 0
              ? 'border-purple-400/40 bg-purple-900/10'
              : 'border-white/5 bg-white/[0.02] hover:border-white/20'
          }`}
          onDragOver={e => e.preventDefault()}
          onDrop={handleDropDS}
          onClick={() => document.getElementById('ds-upload')?.click()}
        >
          <input
            type="file"
            id="ds-upload"
            multiple
            webkitdirectory=""
            directory=""
            className="hidden"
            onChange={e => e.target.files && setDatasets(Array.from(e.target.files))}
          />
          {datasets.length > 0 ? (
            <div className="text-center animate-fade-in">
              <Folder className="text-purple-300 mx-auto mb-3" strokeWidth={1} size={40} />
              <p className="font-medium text-gray-200 text-sm">Dataset Selected</p>
              <p className="text-xs text-gray-500 mt-2 font-mono">{datasets.length} Objects</p>
            </div>
          ) : (
            <div className="text-center">
              <Server className="text-gray-600 mx-auto mb-3" strokeWidth={1} size={40} />
              <p className="font-medium text-gray-300 text-sm">Dataset Folder</p>
              <p className="text-xs text-gray-500 mt-2 font-mono">Optional</p>
            </div>
          )}
        </div>
      </div>

      {/* Region & Analysis Mode */}
      <div className="grid md:grid-cols-2 gap-6 mb-12">
        <div className="border border-white/5 p-4 rounded-xl bg-white/[0.02]">
          <label className="block text-xs font-mono uppercase tracking-widest text-gray-500 mb-3">Region Context</label>
          <RegionDropdown value={region} onChange={setRegion} />
        </div>
        <div className="border border-white/5 p-4 rounded-xl bg-white/[0.02]">
          <label className="block text-xs font-mono uppercase tracking-widest text-gray-500 mb-3">
            Analysis Intensity
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => setRunLive(true)}
              className={`flex-1 p-2 border rounded-lg text-xs font-mono transition-all ${
                runLive
                  ? 'border-purple-500/60 bg-purple-500/10 text-purple-300'
                  : 'border-white/5 text-gray-500 hover:border-white/20'
              }`}
            >
              LIVE TRACE
            </button>
            <button
              onClick={() => setRunLive(false)}
              className={`flex-1 p-2 border rounded-lg text-xs font-mono transition-all ${
                !runLive
                  ? 'border-purple-500/60 bg-purple-500/10 text-purple-300'
                  : 'border-white/5 text-gray-500 hover:border-white/20'
              }`}
            >
              FAST ESTIMATE
            </button>
          </div>
        </div>
      </div>

      {/* Pro Tip for Live Trace */}
      {runLive && (
        <div className="mb-6 p-4 rounded-xl relative overflow-hidden bg-purple-500/10 border border-purple-500/20 animate-fade-in shadow-lg shadow-purple-900/5">
          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-purple-400 to-purple-600"></div>
          <div className="flex gap-3">
            <Zap className="text-purple-400 shrink-0 mt-0.5" size={18} />
            <div>
              <h4 className="text-sm font-semibold text-purple-100 mb-1.5 font-syne tracking-tight">
                Pro Tip: Measuring Massive Notebooks
              </h4>
              <p className="text-xs text-purple-200/70 leading-relaxed font-mono">
                Running a multi-hour pipeline? <strong>Data Subsetting</strong> is the industry standard for fast,
                flawless measurement.
                <br />
                Just truncate your dataset inside your notebook (e.g.{' '}
                <code className="bg-purple-900/40 px-1 py-0.5 rounded text-purple-300 font-bold mx-0.5">
                  df = df.sample(frac=0.1)
                </code>{' '}
                for 10%), run a <strong>Live Trace</strong> to capture exact hardware power metrics, and mathematically
                multiply your final carbon footprint by 10.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Fast Estimate tip */}
      {!runLive && (
        <div className="mb-6 p-4 rounded-xl relative overflow-hidden bg-blue-500/10 border border-blue-500/20 animate-fade-in shadow-lg shadow-blue-900/5">
          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-400 to-blue-600"></div>
          <div className="flex gap-3">
            <Zap className="text-blue-400 shrink-0 mt-0.5" size={18} />
            <div>
              <h4 className="text-sm font-semibold text-blue-100 mb-1.5 font-syne tracking-tight">
                Fast Estimate Mode
              </h4>
              <p className="text-xs text-blue-200/70 leading-relaxed font-mono">
                Estimates carbon emissions using <strong>static AST analysis</strong> — no notebook execution required.
                Results are instant but based on code structure rather than real hardware measurements.
                Use <strong>Live Trace</strong> for precise, per-cell energy readings.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Submit */}
      <button
        onClick={submit}
        disabled={!notebook}
        className={`w-full py-5 rounded-[1.5rem] font-syne font-bold text-lg tracking-tight transition-all ${
          notebook
            ? 'bg-white text-black hover:bg-gray-100 hover:scale-[1.02] shadow-[0_0_30px_rgba(255,255,255,0.1)]'
            : 'bg-white/5 text-gray-600 cursor-not-allowed border border-white/5'
        }`}
      >
        Evaluate Emissions
      </button>
    </div>
  );
}
