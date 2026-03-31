import React from 'react';
import { Activity, Cpu, Zap, Clock, Leaf, Car, Smartphone, Wifi } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend,
} from 'recharts';

// ─────────────────────────────────────────────────────────────────────────────
// Unit auto-scalers — never show 0, always pick the most readable unit
// ─────────────────────────────────────────────────────────────────────────────

/** Smart CO₂ formatter: auto-scales g → mg → µg → ng */
function fmtCO2(grams) {
  if (grams === 0) return { value: '0', unit: 'g CO₂' };
  const abs = Math.abs(grams);
  if (abs >= 1)          return { value: grams.toPrecision(4),          unit: 'g CO₂'  };
  if (abs >= 0.001)      return { value: (grams * 1e3).toPrecision(4),  unit: 'mg CO₂' };
  if (abs >= 0.000001)   return { value: (grams * 1e6).toPrecision(4),  unit: 'µg CO₂' };
  return                        { value: (grams * 1e9).toPrecision(4),  unit: 'ng CO₂' };
}

/** Smart CO₂ string: "1.234 mg CO₂" */
function co2Str(grams) {
  const { value, unit } = fmtCO2(grams);
  return `${value} ${unit}`;
}

/** Smart energy formatter: auto-scales kWh → Wh → mWh → µWh */
function fmtEnergy(kwh) {
  if (kwh === 0) return { value: '0', unit: 'kWh' };
  const abs = Math.abs(kwh);
  if (abs >= 1)        return { value: kwh.toPrecision(4),          unit: 'kWh'  };
  if (abs >= 0.001)    return { value: (kwh * 1e3).toPrecision(4),  unit: 'Wh'   };
  if (abs >= 0.000001) return { value: (kwh * 1e6).toPrecision(4),  unit: 'mWh'  };
  return                      { value: (kwh * 1e9).toPrecision(4),  unit: 'µWh'  };
}

/** Smart duration: s → ms */
function fmtDuration(s) {
  if (s >= 1)    return { value: s.toFixed(3),           unit: 's'  };
  if (s >= 0.001) return { value: (s * 1e3).toFixed(1),  unit: 'ms' };
  return                 { value: (s * 1e6).toFixed(1),  unit: 'µs' };
}

/** Pretty-print a very small number without losing significant digits */
function smartNum(n, sigFigs = 4) {
  if (n === 0) return '0';
  if (Math.abs(n) >= 0.001) return parseFloat(n.toPrecision(sigFigs)).toString();
  return n.toExponential(sigFigs - 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom recharts tooltip for the bar chart — shows scaled units
// ─────────────────────────────────────────────────────────────────────────────

function CellTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const cell = payload[0].payload;
  const { value: co2Val, unit: co2Unit } = fmtCO2(cell.co2_grams);
  const { value: eVal,   unit: eUnit   } = fmtEnergy(cell.energy_kwh);
  const { value: dVal,   unit: dUnit   } = fmtDuration(cell.duration_seconds);
  return (
    <div className="bg-[#0d0d0d] border border-white/10 rounded-xl p-3 text-xs font-mono shadow-2xl max-w-[260px]">
      <p className="text-purple-300 font-bold mb-2">{label}</p>
      <p className="text-gray-400">Type: <span className="text-white">{cell.cell_type}</span></p>
      <p className="text-gray-400">CO₂: <span className="text-emerald-300">{co2Val} {co2Unit}</span></p>
      <p className="text-gray-400">Energy: <span className="text-amber-300">{eVal} {eUnit}</span></p>
      <p className="text-gray-400">Duration: <span className="text-sky-300">{dVal} {dUnit}</span></p>
      {cell.source_preview && (
        <p className="text-gray-600 mt-2 truncate" title={cell.source_preview}>
          {cell.source_preview.slice(0, 55)}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Cell type badge
// ─────────────────────────────────────────────────────────────────────────────

function TypeBadge({ type }) {
  const map = {
    training:      'bg-purple-900/60 text-purple-300 border-purple-700/50',
    testing:       'bg-sky-900/60    text-sky-300    border-sky-700/50',
    preprocessing: 'bg-amber-900/60  text-amber-300  border-amber-700/50',
    other:         'bg-slate-800/60  text-slate-400  border-slate-600/50',
  };
  return (
    <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border ${map[type] || map.other}`}>
      {type}
    </span>
  );
}

// bar colour by cell type
function barColor(type) {
  return type === 'training' ? '#a855f7'
       : type === 'testing'  ? '#38bdf8'
       : type === 'preprocessing' ? '#f59e0b'
       : '#475569';
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Dashboard
// ─────────────────────────────────────────────────────────────────────────────

export default function Dashboard({ data }) {
  const { analysis, suggestions, job_id } = data;
  const { summary, cell_breakdown, static_analysis, hardware_info } = analysis;

  const downloadReport = () =>
    window.open(`http://localhost:8000/api/report/${job_id}`, '_blank');

  // Determine display unit for CO₂ globally so chart + KPI use same scale
  const { value: totalCO2Val, unit: totalCO2Unit } = fmtCO2(summary.total_co2_grams);
  const { value: totalEVal,   unit: totalEUnit   } = fmtEnergy(summary.total_energy_kwh);

  // Convert cell_breakdown co2_grams to chart-friendly scaled values
  const scaleFactor = totalCO2Unit === 'mg CO₂' ? 1e3
                    : totalCO2Unit === 'µg CO₂' ? 1e6
                    : totalCO2Unit === 'ng CO₂' ? 1e9
                    : 1;
  const chartUnit = totalCO2Unit.replace(' CO₂', '');

  const chartData = cell_breakdown.map(c => ({
    ...c,
    co2_scaled: c.co2_grams * scaleFactor,
  }));

  const phaseData = [
    { name: 'Training',      value: summary.training_co2_grams * scaleFactor,  color: '#a855f7' },
    { name: 'Testing',       value: summary.testing_co2_grams  * scaleFactor,  color: '#38bdf8' },
    { name: 'Other',         value: summary.other_co2_grams    * scaleFactor,  color: '#475569' },
  ].filter(d => d.value > 0);

  // Equivalences — smart formatting
  const kmRaw     = summary.equivalent_km_driven;
  const laptopRaw = summary.equivalent_hours_laptop;
  const chargesRaw = summary.equivalent_smartphone_charges;

  const kmDisplay     = kmRaw     < 0.001 ? `${(kmRaw * 1000).toPrecision(3)} m`  : `${smartNum(kmRaw)} km`;
  const laptopDisplay = laptopRaw < 0.001 ? `${(laptopRaw * 3600000).toPrecision(3)} ms` : laptopRaw < 1 ? `${(laptopRaw * 60).toPrecision(3)} min` : `${smartNum(laptopRaw)} h`;
  const chargesDisplay = chargesRaw < 0.001 ? `${(chargesRaw * 1000).toPrecision(3)} m%` : `${smartNum(chargesRaw, 3)}`;

  // Interpretation paragraphs
  const interpParagraphs = suggestions?.interpretation
    ? suggestions.interpretation.split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
    : [];

  const paragraphMeta = [
    { icon: '🌍', label: 'The Big Picture',        accent: 'border-emerald-500/30 bg-emerald-500/5' },
    { icon: '⚡', label: 'Where Energy Was Spent',  accent: 'border-amber-500/30  bg-amber-500/5'   },
    { icon: '🚗', label: 'Real-World Context',      accent: 'border-sky-500/30    bg-sky-500/5'     },
    { icon: '🔬', label: 'About the Measurement',   accent: 'border-violet-500/30 bg-violet-500/5'  },
  ];

  return (
    <div className="w-full max-w-6xl mx-auto space-y-10 animate-fade-in pb-16">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-end border-b border-white/5 pb-6">
        <div>
          <h2 className="text-3xl font-bold font-syne tracking-tighter text-white">
            Analysis Results
          </h2>
          <p className="text-gray-500 font-mono text-xs mt-2 uppercase tracking-widest">
            <span className="text-accent2">{analysis.notebook_name}</span>
            {' // '}{static_analysis.framework} · {static_analysis.model_type}
          </p>
        </div>
        <button
          onClick={downloadReport}
          className="mt-4 md:mt-0 px-6 py-2.5 bg-accentDark/40 hover:bg-accent1/60 text-white rounded-lg border border-accent1/30 text-sm font-sans font-medium transition-all"
        >
          Export PDF
        </button>
      </div>
      {/* ── Execution Warning Banner ──────────────────────────────────────── */}
      {analysis.execution_note && (
        <div className="flex gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 text-amber-300">
          <span className="text-xl shrink-0 mt-0.5">⚠️</span>
          <div>
            <p className="text-sm font-semibold mb-1">
              {analysis.cells_with_errors} cell{analysis.cells_with_errors > 1 ? 's' : ''} failed during execution
            </p>
            <p className="text-xs text-amber-400/70 leading-relaxed">
              {analysis.execution_note}
            </p>
            <p className="text-xs text-amber-400/50 mt-2 font-mono">
              Tip: Make sure the dataset you upload matches what the notebook tries to load (e.g. same filename and format).
            </p>
          </div>
        </div>
      )}

      {/* ── KPI Row ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Carbon */}
        <div className="metric-card">
          <p className="text-xs text-gray-500 font-mono uppercase tracking-widest mb-1">Total Carbon</p>
          <h3 className="text-3xl font-syne font-bold text-white break-all">
            {totalCO2Val}
            <span className="text-sm text-accent2 opacity-60 ml-1">{totalCO2Unit}</span>
          </h3>
        </div>
        {/* Energy Draw */}
        <div className="metric-card">
          <p className="text-xs text-gray-500 font-mono uppercase tracking-widest mb-1">Energy Draw</p>
          <h3 className="text-3xl font-syne font-bold text-white break-all">
            {totalEVal}
            <span className="text-sm text-accent2 opacity-60 ml-1">{totalEUnit}</span>
          </h3>
        </div>
        {/* Equiv. Driving */}
        <div className="metric-card">
          <p className="text-xs text-gray-500 font-mono uppercase tracking-widest mb-1">Equiv. Driving</p>
          <h3 className="text-3xl font-syne font-bold text-white break-all">
            {kmDisplay}
          </h3>
        </div>
        {/* Runtime */}
        <div className="metric-card">
          <p className="text-xs text-gray-500 font-mono uppercase tracking-widest mb-1">Total Runtime</p>
          <h3 className="text-3xl font-syne font-bold text-white">
            {fmtDuration(summary.total_duration_seconds).value}
            <span className="text-sm text-accent2 opacity-60 ml-1">
              {fmtDuration(summary.total_duration_seconds).unit}
            </span>
          </h3>
        </div>
      </div>

      {/* ── Emission Summary Detail Strip ───────────────────────────────────── */}
      <div className="glass-panel p-5 border-white/5">
        <h3 className="text-xs font-mono uppercase tracking-widest text-gray-500 mb-4">
          Emission Summary
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {[
            { label: 'Grid Intensity',   value: `${summary.grid_intensity_g_per_kwh} gCO₂/kWh`, sub: summary.region || 'Global avg' },
            { label: 'Training CO₂',    value: co2Str(summary.training_co2_grams),               sub: `${summary.training_co2_grams === 0 ? '0' : ((summary.training_co2_grams / (summary.total_co2_grams || 1)) * 100).toFixed(1)}% of total` },
            { label: 'Laptop Equiv.',   value: laptopDisplay,                                     sub: 'laptop runtime' },
            { label: 'Phone Charges',   value: `${smartNum(chargesRaw, 3)} charges`,              sub: 'smartphone equiv.' },
          ].map(({ label, value, sub }) => (
            <div key={label} className="border border-white/5 rounded-xl p-3">
              <p className="text-gray-600 text-[10px] uppercase tracking-widest font-mono mb-1">{label}</p>
              <p className="text-white font-semibold font-mono text-sm">{value}</p>
              <p className="text-gray-600 text-[10px] mt-0.5">{sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Charts ──────────────────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Bar chart */}
        <div className="lg:col-span-2 glass-panel p-6 border-white/5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-mono uppercase tracking-widest text-gray-500">
              Emissions Per Cell
            </h3>
            <span className="text-[10px] font-mono text-gray-600 bg-white/5 px-2 py-1 rounded">
              unit: {chartUnit}
            </span>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <XAxis
                  dataKey="cell_label"
                  tick={{ fill: '#64748b', fontSize: 9 }}
                  axisLine={{ stroke: '#334155' }}
                  tickLine={false}
                  interval={Math.max(0, Math.floor(chartData.length / 20) - 1)}
                />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => v === 0 ? '0' : v.toPrecision(3)}
                />
                <Tooltip content={<CellTooltip />} />
                <Bar dataKey="co2_scaled" radius={[3, 3, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={barColor(entry.cell_type)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Legend */}
          <div className="flex gap-4 mt-3 justify-center text-[10px] font-mono text-gray-500">
            {[['training','#a855f7'],['testing','#38bdf8'],['preprocessing','#f59e0b'],['other','#475569']].map(([t,c]) => (
              <span key={t} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: c }} />
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Pie */}
        <div className="glass-panel p-6">
          <h3 className="text-sm font-mono uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2">
            <Activity size={14} /> Phase Share
          </h3>
          <div className="h-56 relative">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={phaseData}
                  cx="50%" cy="50%"
                  innerRadius={55} outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="none"
                >
                  {phaseData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) => [`${parseFloat(v.toPrecision(4))} ${chartUnit}`, 'CO₂']}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: 12 }}
                />
                <Legend
                  verticalAlign="bottom" height={30} iconType="circle"
                  formatter={(value) => <span style={{ color: '#94a3b8', fontSize: 11 }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginBottom: 30 }}>
              <span className="text-xl font-bold text-white font-syne">
                {fmtDuration(summary.total_duration_seconds).value}
                <span className="text-xs text-slate-400 ml-0.5">{fmtDuration(summary.total_duration_seconds).unit}</span>
              </span>
              <span className="text-[9px] text-slate-500 uppercase tracking-widest">runtime</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Per-Cell Detailed Table (CodeCarbon-style breakdown) ───────────── */}
      <div className="glass-panel p-6 border-white/5">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-mono uppercase tracking-widest text-gray-500">
            Cell-by-Cell Breakdown
          </h3>
          <div className="flex gap-3 text-[10px] font-mono text-gray-600">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block bg-sky-500/70" />CPU</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block bg-emerald-500/70" />RAM</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block bg-amber-500/70" />GPU</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-white/5 text-gray-600 uppercase tracking-widest text-[10px]">
                <th className="text-left pb-3 pr-3 font-normal w-16">Cell</th>
                <th className="text-left pb-3 pr-3 font-normal">Type</th>
                <th className="text-right pb-3 pr-3 font-normal">Duration</th>
                <th className="text-right pb-3 pr-3 font-normal">CPU Energy</th>
                <th className="text-right pb-3 pr-3 font-normal">RAM Energy</th>
                <th className="text-right pb-3 pr-3 font-normal">GPU Energy</th>
                <th className="text-right pb-3 pr-3 font-normal">Total CO₂</th>
                <th className="text-left pb-3 font-normal">Distribution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {cell_breakdown.map((cell, i) => {
                const { value: co2V, unit: co2U } = fmtCO2(cell.co2_grams);
                const { value: dV,   unit: dU   } = fmtDuration(cell.duration_seconds);

                const cpuE   = cell.cpu_energy_kwh || 0;
                const ramE   = cell.ram_energy_kwh || 0;
                const gpuE   = cell.gpu_energy_kwh || 0;
                const totE   = cpuE + ramE + gpuE || cell.energy_kwh || 1e-12;

                const cpuPct = totE > 0 ? (cpuE / totE) * 100 : 0;
                const ramPct = totE > 0 ? (ramE / totE) * 100 : 0;
                const gpuPct = totE > 0 ? (gpuE / totE) * 100 : 0;

                const { value: cpuV, unit: cpuU } = fmtEnergy(cpuE);
                const { value: ramV, unit: ramU } = fmtEnergy(ramE);
                const { value: gpuV, unit: gpuU } = fmtEnergy(gpuE);

                const isHeavy = cell.co2_grams >= (summary.total_co2_grams * 0.1);

                return (
                  <tr key={i} className={`group hover:bg-white/[0.02] transition-colors ${isHeavy ? 'bg-amber-900/5' : ''} ${cell.execution_error ? 'bg-red-900/5' : ''}`}>
                    <td className="py-3 pr-3 text-gray-500 whitespace-nowrap">
                      {cell.cell_label}
                      {cell.execution_error && (
                        <span title={cell.execution_error} className="ml-1.5 text-red-400 cursor-help" aria-label="Cell failed">⚠</span>
                      )}
                    </td>
                    <td className="py-3 pr-3"><TypeBadge type={cell.cell_type} /></td>
                    <td className="py-3 pr-3 text-right text-sky-400 tabular-nums whitespace-nowrap">
                      {dV}<span className="text-gray-600 ml-0.5">{dU}</span>
                    </td>
                    {/* CPU */}
                    <td className="py-3 pr-3 text-right tabular-nums whitespace-nowrap">
                      <span className="text-sky-300">{cpuV}</span>
                      <span className="text-gray-600 ml-0.5">{cpuU}</span>
                      {cell.cpu_power_w > 0 && (
                        <div className="text-gray-600 text-[9px]">{cell.cpu_power_w.toFixed(2)} W</div>
                      )}
                    </td>
                    {/* RAM */}
                    <td className="py-3 pr-3 text-right tabular-nums whitespace-nowrap">
                      <span className="text-emerald-300">{ramV}</span>
                      <span className="text-gray-600 ml-0.5">{ramU}</span>
                      {cell.ram_power_w > 0 && (
                        <div className="text-gray-600 text-[9px]">{cell.ram_power_w.toFixed(2)} W</div>
                      )}
                    </td>
                    {/* GPU */}
                    <td className="py-3 pr-3 text-right tabular-nums whitespace-nowrap">
                      {gpuE > 0 ? (
                        <>
                          <span className="text-amber-300">{gpuV}</span>
                          <span className="text-gray-600 ml-0.5">{gpuU}</span>
                          {cell.gpu_power_w > 0 && (
                            <div className="text-gray-600 text-[9px]">{cell.gpu_power_w.toFixed(2)} W</div>
                          )}
                        </>
                      ) : (
                        <span className="text-gray-700">—</span>
                      )}
                    </td>
                    {/* Total CO₂ */}
                    <td className="py-3 pr-3 text-right tabular-nums whitespace-nowrap">
                      <span className={isHeavy ? 'text-amber-300 font-bold' : 'text-purple-300'}>
                        {co2V}
                      </span>
                      <span className="text-gray-600 ml-0.5">{co2U}</span>
                    </td>
                    {/* Stacked mini bar */}
                    <td className="py-3 min-w-[80px]">
                      <div className="flex h-3 rounded overflow-hidden gap-px w-20">
                        {cpuPct > 0 && <div className="bg-sky-500/70" style={{ width: `${cpuPct}%` }} title={`CPU ${cpuPct.toFixed(0)}%`} />}
                        {ramPct > 0 && <div className="bg-emerald-500/70" style={{ width: `${ramPct}%` }} title={`RAM ${ramPct.toFixed(0)}%`} />}
                        {gpuPct > 0 && <div className="bg-amber-500/70" style={{ width: `${gpuPct}%` }} title={`GPU ${gpuPct.toFixed(0)}%`} />}
                      </div>
                      <div className="text-[9px] text-gray-700 mt-0.5">
                        {cpuPct.toFixed(0)}% / {ramPct.toFixed(0)}% / {gpuPct.toFixed(0)}%
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Summary footer row */}
            <tfoot>
              <tr className="border-t border-white/10 text-gray-500">
                <td colSpan={2} className="pt-3 text-[10px] uppercase tracking-widest">Total</td>
                <td className="pt-3 text-right text-sky-400/70 text-[10px]">
                  {fmtDuration(summary.total_duration_seconds).value} {fmtDuration(summary.total_duration_seconds).unit}
                </td>
                <td className="pt-3 text-right text-sky-300/70 text-[10px]">
                  {fmtEnergy(cell_breakdown.reduce((s,c)=>s+(c.cpu_energy_kwh||0),0)).value}
                  {' '}{fmtEnergy(cell_breakdown.reduce((s,c)=>s+(c.cpu_energy_kwh||0),0)).unit}
                </td>
                <td className="pt-3 text-right text-emerald-300/70 text-[10px]">
                  {fmtEnergy(cell_breakdown.reduce((s,c)=>s+(c.ram_energy_kwh||0),0)).value}
                  {' '}{fmtEnergy(cell_breakdown.reduce((s,c)=>s+(c.ram_energy_kwh||0),0)).unit}
                </td>
                <td className="pt-3 text-right text-amber-300/70 text-[10px]">
                  {fmtEnergy(cell_breakdown.reduce((s,c)=>s+(c.gpu_energy_kwh||0),0)).value}
                  {' '}{fmtEnergy(cell_breakdown.reduce((s,c)=>s+(c.gpu_energy_kwh||0),0)).unit}
                </td>
                <td className="pt-3 text-right font-bold text-purple-300 text-[10px]">
                  {fmtCO2(summary.total_co2_grams).value} {fmtCO2(summary.total_co2_grams).unit}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>


      {/* ── Interpretation ───────────────────────────────────────────────────── */}
      {interpParagraphs.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 pb-2 border-b border-white/5">
            <span className="text-lg"></span>
            <h3 className="text-sm font-mono uppercase tracking-widest text-gray-400">
              What Does This Actually Mean?
            </h3>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {interpParagraphs.map((para, i) => {
              const meta = paragraphMeta[i] || { icon: '📌', label: `Note ${i+1}`, accent: 'border-white/10 bg-white/5' };
              return (
                <div key={i} className={`rounded-2xl border p-5 ${meta.accent} hover:brightness-110 transition-all`}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl leading-none">{meta.icon}</span>
                    <span className="text-xs font-mono uppercase tracking-widest text-gray-400">
                      {meta.label}
                    </span>
                  </div>
                  <p className="text-sm text-gray-200 leading-relaxed font-sans">{para}</p>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-gray-600 font-mono text-center pt-1">
            ⓘ Measurements use live kernel CPU profiling + TDP modelling. Results may vary ±10–30% between runs due to OS scheduling &amp; background processes.
          </p>
        </div>
      )}

      {/* ── Notebook & Hardware Analysis ─────────────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-8">

        {/* Hardware & Static Analysis Card */}
        <div className="lg:col-span-1 glass-panel p-6 border-white/5 space-y-5">
          <h4 className="text-xs text-accent2 uppercase tracking-widest font-mono">
            Notebook &amp; Hardware Analysis
          </h4>

          {/* Notebook analysis */}
          <div className="space-y-2.5 text-sm font-sans">
            {[
              { label: 'Framework',       value: static_analysis.framework },
              { label: 'Model Type',      value: static_analysis.model_type },
              { label: 'Complexity',      value: static_analysis.complexity_tier.toUpperCase(), accent: true },
              { label: 'Training Cells',  value: static_analysis.training_cell_indices.length },
              { label: 'Testing Cells',   value: static_analysis.testing_cell_indices.length },
              { label: 'Prep. Cells',     value: static_analysis.preprocessing_cell_indices.length },
            ].map(({ label, value, accent }) => (
              <div key={label} className="flex justify-between border-b border-white/[0.04] pb-2">
                <span className="text-gray-500">{label}</span>
                <span className={`font-medium text-right pl-3 ${accent ? 'text-accent1 text-xs tracking-widest' : 'text-gray-200'}`}>
                  {value}
                </span>
              </div>
            ))}
            {static_analysis.detected_patterns?.length > 0 && (
              <div className="pt-1">
                <p className="text-gray-600 text-[10px] uppercase tracking-widest mb-2">Detected Optimizations</p>
                <div className="flex flex-wrap gap-1.5">
                  {static_analysis.detected_patterns.map(p => (
                    <span key={p} className="text-[10px] bg-emerald-900/30 text-emerald-400 border border-emerald-700/30 px-2 py-0.5 rounded-full font-mono">
                      {p.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-white/5 pt-4">
            <p className="text-gray-600 text-[10px] uppercase tracking-widest mb-3 font-mono">Hardware</p>
            <div className="space-y-2.5 text-sm font-sans">
              {[
                { label: 'CPU',      value: hardware_info.cpu_model },
                { label: 'Cores',    value: `${hardware_info.cpu_count} physical` },
                { label: 'RAM',      value: `${hardware_info.ram_gb} GB` },
                { label: 'Platform', value: `${hardware_info.os}` },
                { label: 'GPU',      value: hardware_info.gpu_model || 'Not detected', accent: hardware_info.gpu_available },
              ].map(({ label, value, accent }) => (
                <div key={label} className="flex justify-between border-b border-white/[0.04] pb-2">
                  <span className="text-gray-500">{label}</span>
                  <span className={`font-medium text-right pl-3 truncate max-w-[160px] ${accent ? 'text-accent2' : 'text-gray-300'}`}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* AI Recommendations */}
        <div className="lg:col-span-2 glass-panel p-6 border-white/5">
          <h3 className="text-sm font-mono uppercase tracking-widest text-accent2 mb-5">
            AI Optimizations
          </h3>
          {suggestions?.summary_insight && (
            <p className="text-sm text-gray-300 leading-relaxed mb-6 border-l border-accent1/50 pl-4 py-1">
              {suggestions.summary_insight}
            </p>
          )}
          <div className="space-y-4">
            {suggestions?.suggestions?.map((sug, i) => (
              <div key={i} className="group p-5 rounded-2xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] transition-colors">
                <div className="flex justify-between items-start mb-2 gap-3">
                  <h4 className="font-bold font-syne text-[15px] text-gray-200">{sug.title}</h4>
                  <span className={`shrink-0 text-[10px] uppercase font-mono tracking-wider px-2 py-1 rounded bg-black/40 border border-white/5
                    ${sug.impact === 'high' ? 'text-red-400' : sug.impact === 'medium' ? 'text-accent2' : 'text-gray-400'}`}>
                    {sug.impact} impact
                  </span>
                </div>
                <p className="text-sm text-gray-400 leading-relaxed font-sans mb-3">{sug.description}</p>
                <div className="flex justify-between items-center text-xs text-gray-600 font-mono">
                  <span>{sug.estimated_savings && `⚡ ${sug.estimated_savings}`}</span>
                  <span className="text-gray-700">Ref: {sug.source_reference}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ── Global Disclaimer ──────────────────────────────────────────────── */}
      <div className="mt-12 pt-8 pb-4 border-t border-white/5 text-center flex flex-col items-center max-w-5xl mx-auto">
        <p className="text-[11px] text-gray-500 font-mono leading-relaxed max-w-4xl">
          <span className="text-gray-400 font-bold tracking-wider uppercase mr-2 text-red-500">Accuracy Notice:</span>
          GreenTrace provides precise computational estimates using hardware TDP profiles, active RAM sampling, and localized grid intensity data. However, we do not claim these figures guarantee absolute audited accuracy. Real-world emissions may fluctuate based on background OS processes, hypervisor scheduling, dynamic GPU voltages, and real-time power grid generation ratios. These metrics are designed to provide a highly reliable directional baseline for reducing the footprint of complex AI workloads.
        </p>
      </div>
      
    </div>
  );
}
