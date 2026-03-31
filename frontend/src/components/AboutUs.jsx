import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Zap, Activity, Shield, Cpu, Leaf, FileText, ChevronDown, Star, Globe, Lock, TrendingUp } from 'lucide-react';
import logo from '../assets/logo.png';

/* ─── Animated counter hook ─────────────────────────────────────────────── */
function useCountUp(target, duration = 1800, active = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!active) return;
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration, active]);
  return count;
}

/* ─── Intersection observer hook ────────────────────────────────────────── */
function useInView(threshold = 0.15) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView];
}

/* ─── Stat card with animated counter ───────────────────────────────────── */
function StatCard({ value, suffix, label, color }) {
  const [ref, inView] = useInView();
  const count = useCountUp(value, 1600, inView);
  return (
    <div ref={ref} className="flex flex-col items-center p-6 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-all duration-500 group">
      <span className={`text-4xl md:text-5xl font-syne font-bold tracking-tighter ${color}`}>
        {count.toLocaleString()}{suffix}
      </span>
      <span className="text-xs font-mono uppercase tracking-widest text-gray-500 mt-2 text-center">{label}</span>
    </div>
  );
}

/* ─── Section fade-in wrapper ────────────────────────────────────────────── */
function FadeSection({ children, className = '', delay = 0 }) {
  const [ref, inView] = useInView(0.1);
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ─── Mode comparison card ───────────────────────────────────────────────── */
function ModeCard({ icon: Icon, tag, title, tagColor, borderColor, glowColor, description, bullets, accuracy }) {
  return (
    <div className={`relative flex flex-col rounded-3xl border ${borderColor} bg-white/[0.02] p-8 overflow-hidden hover:bg-white/[0.035] transition-all duration-500 group`}>
      {/* glow blob */}
      <div className={`absolute -top-16 -right-16 w-48 h-48 rounded-full ${glowColor} blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none`} />
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-5">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${borderColor} bg-black/40`}>
            <Icon size={18} className={tagColor} />
          </div>
          <span className={`text-xs font-mono uppercase tracking-widest px-3 py-1 rounded-full border ${borderColor} ${tagColor} bg-black/30`}>{tag}</span>
        </div>
        <h3 className="text-2xl font-syne font-bold text-white mb-3 tracking-tight">{title}</h3>
        <p className="text-gray-400 text-sm leading-relaxed mb-5 font-sans">{description}</p>
        <ul className="space-y-2.5">
          {bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-gray-300">
              <span className={`mt-0.5 shrink-0 ${tagColor}`}>›</span>
              <span className="font-sans leading-relaxed">{b}</span>
            </li>
          ))}
        </ul>
        <div className={`mt-6 pt-5 border-t border-white/5`}>
          <p className="text-[10px] font-mono uppercase tracking-widest text-gray-600 mb-1">Accuracy Profile</p>
          <p className={`text-sm font-semibold ${tagColor}`}>{accuracy}</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Process step ───────────────────────────────────────────────────────── */
function Step({ number, title, description, icon: Icon, color, delay }) {
  return (
    <FadeSection delay={delay}>
      <div className="flex gap-5 group">
        <div className="flex flex-col items-center">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${color.border} ${color.bg} shrink-0 group-hover:scale-110 transition-transform duration-300`}>
            <Icon size={16} className={color.icon} />
          </div>
          <div className={`w-px flex-1 mt-3 ${color.line}`} />
        </div>
        <div className="pb-10">
          <div className="flex items-center gap-3 mb-2">
            <span className={`text-xs font-mono ${color.icon} opacity-60`}>0{number}</span>
            <h4 className="text-base font-syne font-bold text-white tracking-tight">{title}</h4>
          </div>
          <p className="text-sm text-gray-400 leading-relaxed font-sans max-w-xl">{description}</p>
        </div>
      </div>
    </FadeSection>
  );
}

/* ─── Feature pill ──────────────────────────────────────────────────────── */
function FeaturePill({ label, icon: Icon, color }) {
  return (
    <div className={`flex items-center gap-2 px-4 py-2.5 rounded-full border ${color.border} ${color.bg} hover:scale-105 transition-transform duration-200 cursor-default`}>
      <Icon size={13} className={color.icon} />
      <span className={`text-xs font-mono ${color.icon}`}>{label}</span>
    </div>
  );
}

/* ─── FAQ item ──────────────────────────────────────────────────────────── */
function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-2xl border transition-all duration-300 overflow-hidden ${open ? 'border-purple-500/30 bg-purple-500/5' : 'border-white/5 bg-white/[0.02]'}`}>
      <button
        className="w-full flex items-center justify-between p-5 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-sm font-syne font-semibold text-gray-200 pr-4">{q}</span>
        <ChevronDown size={16} className={`text-gray-500 shrink-0 transition-transform duration-300 ${open ? 'rotate-180 text-purple-400' : ''}`} />
      </button>
      {open && (
        <div className="px-5 pb-5 animate-fade-in">
          <p className="text-sm text-gray-400 leading-relaxed font-sans">{a}</p>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   Main About Us Component
   ════════════════════════════════════════════════════════════════════════════ */
export default function AboutUs({ onBack }) {
  // Scroll to top on mount
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, []);

  const steps = [
    {
      number: 1, icon: FileText, title: 'Upload Your Notebook',
      description: 'Drop your Jupyter Notebook (.ipynb) and optionally attach your dataset folder. GreenTrace accepts any Python-based notebook—from quick EDA scripts to multi-day training pipelines. Dataset uploads are capped at 1,000 files to protect our free infrastructure.',
      color: { border: 'border-purple-500/30', bg: 'bg-purple-500/10', icon: 'text-purple-300', line: 'bg-gradient-to-b from-purple-500/30 to-transparent' }
    },
    {
      number: 2, icon: Activity, title: 'Choose Your Analysis Mode',
      description: 'Select Live Trace for cell-by-cell dynamic execution with real hardware profiling, or Fast Estimate for an instant AST-based static analysis. Both modes produce a full per-cell emission breakdown.',
      color: { border: 'border-green-500/30', bg: 'bg-green-500/10', icon: 'text-green-300', line: 'bg-gradient-to-b from-green-500/30 to-transparent' }
    },
    {
      number: 3, icon: Cpu, title: 'Hardware Profiling & Emission Calculation',
      description: 'For Live Trace, GreenTrace executes each cell in a secure, isolated environment—measuring real-time CPU wattage, RAM draw, and GPU voltage. This is multiplied by your region\'s grid carbon intensity (gCO₂/kWh) to yield per-cell carbon figures.',
      color: { border: 'border-sky-500/30', bg: 'bg-sky-500/10', icon: 'text-sky-300', line: 'bg-gradient-to-b from-sky-500/30 to-transparent' }
    },
    {
      number: 4, icon: Zap, title: 'AI-Powered Summarization & Optimization',
      description: 'Our AI engine cross-references your notebook\'s structure against a database of sustainable software engineering practices. It generates a plain-English summary of environmental efficiency, pinpoints your highest-emission cells, and delivers concrete, estimated-savings-ranked recommendations.',
      color: { border: 'border-amber-500/30', bg: 'bg-amber-500/10', icon: 'text-amber-300', line: 'bg-gradient-to-b from-amber-500/30 to-transparent' }
    },
    {
      number: 5, icon: FileText, title: 'Export Your Carbon Report (PDF)',
      description: 'Every completed analysis produces a downloadable PDF report containing the full cell-by-cell breakdown, phase-level emission shares, hardware metadata, and all AI optimization recommendations. The report is audit-ready and can be shared with teams, institutions, or compliance bodies to demonstrate carbon-aware development practices.',
      color: { border: 'border-rose-500/30', bg: 'bg-rose-500/10', icon: 'text-rose-300', line: 'bg-gradient-to-b from-rose-500/30 to-transparent' }
    },
  ];

  const faqs = [
    {
      q: 'Does my notebook HAVE to run without errors before I upload it?',
      a: 'Yes — for Live Trace, your notebook must run perfectly from start to finish on your own machine first. GreenTrace cannot fully evaluate a notebook that contains syntax errors or relies on missing files. However, if a crash occurs mid-execution, GreenTrace safely saves all measurements up to the point of failure and highlights the failing cell with a warning icon.'
    },
    {
      q: 'My dataset has more than 1,000 files. What should I do?',
      a: 'Subset your data inside the notebook before uploading — for example, use df = df.sample(frac=0.1) to use 10% of your data. Run the Live Trace on the subset, then multiply your final carbon figure by 10 to extrapolate the full-dataset footprint. This is the industry-standard measurement technique for large-scale pipelines.'
    },
    {
      q: 'Why are the CO₂ numbers on the free website "estimations" and not exact?',
      a: 'Free cloud providers run our app inside shared Docker containers that block access to physical motherboard sensors (like Intel RAPL) for security reasons. Live Trace on the cloud therefore uses a fallback: it reads the percentage of virtual CPU used and multiplies by a generic cloud TDP rating. This accurately ranks your cells by energy cost, but the absolute CO₂ gram values are educated estimations. Locally, or on a premium Bare-Metal server, measurements are 100% physically accurate.'
    },
    {
      q: 'Is Fast Estimate the same accuracy locally vs. in the cloud?',
      a: 'Yes — Fast Estimate uses pure static AST (Abstract Syntax Tree) analysis and never touches hardware sensors. It applies mathematical formulas to your code\'s structure regardless of where it runs, so the accuracy is identical whether you use our free website or run GreenTrace locally. It will always be less precise than Live Trace but is instant and consistent.'
    },
    {
      q: 'What does the AI actually recommend?',
      a: 'The AI analyzes your notebook\'s detected framework (PyTorch, TensorFlow, scikit-learn, etc.), identifies your most emission-heavy cells, and cross-references them against sustainable software engineering practices. Typical recommendations include switching to mixed-precision training (fp16), optimizing data loaders, batching inference calls, or suggesting hardware accelerators. Every recommendation includes an estimated energy savings percentage.'
    },
    {
      q: 'What is in the exported PDF report?',
      a: 'The PDF contains your complete analysis: total CO₂ and energy figures, per-cell breakdown with CPU/RAM/GPU splits, phase-level pie chart (training vs. testing vs. other), hardware metadata, real-world equivalences (km driven, laptop hours, phone charges), the full AI interpretation, and all optimization recommendations ranked by impact. It\'s designed to be shareable for compliance or team review purposes.'
    },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#030303' }}>

      {/* ── Sticky nav ─────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-white/5 backdrop-blur-xl bg-[#030303]/80">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-4 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2.5 text-sm text-gray-400 hover:text-white transition-colors group"
          >
            <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform duration-200" />
            <span className="font-mono">Back</span>
          </button>
          <div className="flex items-center gap-3">
            <img src={logo} alt="GreenTrace" className="w-7 h-7 object-contain" />
            <span className="font-syne font-bold text-white text-lg tracking-tight">GreenTrace</span>
          </div>
          <div className="px-4 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-mono text-gray-500">v1.0</div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 md:px-12 pb-32">

        {/* ── Hero ───────────────────────────────────────────────────────────── */}
        <section className="pt-24 pb-20 relative">
          {/* ambient glows */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-purple-600/8 blur-[120px] pointer-events-none" />
          <div className="absolute top-20 left-1/4 w-[300px] h-[300px] rounded-full bg-green-600/6 blur-[100px] pointer-events-none" />

          <div className="relative z-10 text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-purple-500/30 bg-purple-500/10 text-xs font-mono text-purple-300 mb-8 animate-fade-in">
              <Leaf size={11} />
              <span>ABOUT GREENTRACE</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-syne font-bold tracking-tighter text-white mb-6 leading-[0.95]">
              Your Code's
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-purple-400 to-purple-600">
                Smart Meter
              </span>
            </h1>

            <p className="text-lg md:text-xl text-gray-400 leading-relaxed max-w-2xl mx-auto font-sans mb-10">
              As machine learning models grow exponentially in size, so does the energy required to train them.
              GreenTrace acts as your code's smart meter — breaking down exactly how much energy your Jupyter Notebooks
              consume, and providing actionable AI-driven strategies to reduce your environmental impact
              <strong className="text-gray-200"> without sacrificing performance.</strong>
            </p>

            <div className="flex flex-wrap gap-3 justify-center">
              {[
                { label: 'Cell-by-Cell Profiling', icon: Activity, color: { border: 'border-purple-500/30', bg: 'bg-purple-500/10', icon: 'text-purple-300' } },
                { label: 'AI Recommendations', icon: Zap, color: { border: 'border-amber-500/30', bg: 'bg-amber-500/10', icon: 'text-amber-300' } },
                { label: 'Region-Aware CO₂', icon: Globe, color: { border: 'border-green-500/30', bg: 'bg-green-500/10', icon: 'text-green-300' } },
                { label: 'Secure Execution', icon: Lock, color: { border: 'border-sky-500/30', bg: 'bg-sky-500/10', icon: 'text-sky-300' } },
                { label: 'PDF Export', icon: FileText, color: { border: 'border-rose-500/30', bg: 'bg-rose-500/10', icon: 'text-rose-300' } },
                { label: 'Completely Free', icon: Star, color: { border: 'border-white/10', bg: 'bg-white/5', icon: 'text-gray-300' } },
              ].map(f => <FeaturePill key={f.label} {...f} />)}
            </div>
          </div>
        </section>

        {/* ── Stats row ──────────────────────────────────────────────────────── */}
        <FadeSection>
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-24">
            <StatCard value={5} suffix="+" label="Grid Regions Supported" color="text-green-400" />
            <StatCard value={1000} suffix="" label="Max Dataset Files" color="text-purple-400" />
            <StatCard value={100} suffix="%" label="Free To Use" color="text-amber-400" />
            <StatCard value={2} suffix="" label="Analysis Modes" color="text-sky-400" />
          </section>
        </FadeSection>

        {/* ── Tracking modes ─────────────────────────────────────────────────── */}
        <section className="mb-24">
          <FadeSection>
            <div className="text-center mb-12">
              <p className="text-xs font-mono uppercase tracking-widest text-gray-600 mb-3">Core Technology</p>
              <h2 className="text-3xl md:text-4xl font-syne font-bold text-white tracking-tight">
                Two Ways to <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-green-400">Trace Your Footprint</span>
              </h2>
              <p className="text-gray-500 text-sm font-sans mt-3 max-w-xl mx-auto">
                Choose the analysis method that fits your workflow — high-fidelity execution or instant static scanning.
              </p>
            </div>
          </FadeSection>

          <div className="grid md:grid-cols-2 gap-6">
            <FadeSection delay={0}>
              <ModeCard
                icon={Activity}
                tag="Live Trace"
                title="Dynamic Execution"
                tagColor="text-green-300"
                borderColor="border-green-500/20"
                glowColor="bg-green-500/15"
                description="The most detailed analysis available. GreenTrace actively executes your entire Jupyter Notebook cell by cell inside a secure server environment, measuring the real-time energy draw of the CPU and RAM."
                bullets={[
                  'Locally: Uses low-level hardware sensors (Intel RAPL) directly on your motherboard for flawless, micro-joule-accurate readings.',
                  'On the cloud: Falls back to CPU-usage × TDP profile estimation since Docker containers block physical sensor access. Accurately ranks cells by relative cost.',
                  'Produces a live per-cell emission table with CPU, RAM, and GPU energy splits.',
                  'Graceful crash recovery — saves all metrics up to the point of failure and flags the offending cell.',
                ]}
                accuracy="Locally: 100% precise. Cloud: High-precision estimation (±10–30%)"
              />
            </FadeSection>
            <FadeSection delay={150}>
              <ModeCard
                icon={Zap}
                tag="Fast Estimate"
                title="Static AST Analysis"
                tagColor="text-purple-300"
                borderColor="border-purple-500/20"
                glowColor="bg-purple-500/15"
                description="Instantaneous carbon estimation without executing a single line of code. Scans the Abstract Syntax Tree (the structural blueprint) of your Python code to calculate estimated power draw."
                bullets={[
                  'Detects deep learning frameworks (PyTorch, TensorFlow), training loops, and heavy data processing blocks.',
                  'Applies industry-standard mathematical formulas and hardware TDP constants to estimate energy.',
                  'Produces identical estimated accuracy whether run locally or on the cloud — mathematically consistent.',
                  'Results are instant — no notebook execution required, no dataset needed.',
                ]}
                accuracy="Consistent everywhere — structure-based, not sensor-based"
              />
            </FadeSection>
          </div>
        </section>

        {/* ── How it works / Steps ───────────────────────────────────────────── */}
        <section className="mb-24">
          <FadeSection>
            <div className="mb-12">
              <p className="text-xs font-mono uppercase tracking-widest text-gray-600 mb-3">End-to-End Workflow</p>
              <h2 className="text-3xl md:text-4xl font-syne font-bold text-white tracking-tight">
                From Upload to <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-rose-400">Actionable Report</span>
              </h2>
            </div>
          </FadeSection>
          <div className="max-w-3xl">
            {steps.map((s, i) => <Step key={i} {...s} delay={i * 80} />)}
          </div>
        </section>

        {/* ── Before You Upload section ───────────────────────────────────────── */}
        <section className="mb-24">
          <FadeSection>
            <div className="rounded-3xl border border-white/5 bg-white/[0.015] p-8 md:p-12 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-8">
                  
                  <div>
                    <p className="text-xs font-mono uppercase tracking-widest text-gray-600">Prerequisites</p>
                    <h2 className="text-2xl font-syne font-bold text-white tracking-tight">Before You Upload</h2>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="p-6 rounded-2xl border border-amber-500/20 bg-amber-500/5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-amber-400 font-syne font-bold text-xs uppercase tracking-widest">The Flawless Run Rule</span>
                    </div>
                    <p className="text-sm text-gray-300 leading-relaxed font-sans">
                      Your Jupyter Notebook (<code className="bg-white/5 px-1.5 py-0.5 rounded text-amber-300 font-mono text-xs">.ipynb</code>) <strong className="text-white">must run perfectly from start to finish</strong> on your own computer before uploading.
                      If your code has syntax errors or relies on files you forgot to include, GreenTrace cannot fully evaluate the infrastructure profile.
                    </p>
                  </div>
                  <div className="p-6 rounded-2xl border border-purple-500/20 bg-purple-500/5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-purple-400 font-syne font-bold text-xs uppercase tracking-widest">Uploading Datasets</span>
                    </div>
                    <p className="text-sm text-gray-300 leading-relaxed font-sans">
                      If your notebook loads external data (CSVs, images, JSONs), upload the accompanying dataset folder.
                      Datasets are <strong className="text-white">strictly limited to 1,000 files</strong> to protect our free infrastructure.
                      Subset your data (e.g., <code className="bg-white/5 px-1.5 py-0.5 rounded text-purple-300 font-mono text-xs">df.sample(frac=0.1)</code>) and multiply your result by 10 afterward.
                    </p>
                  </div>
                </div>

                {/* crash recovery callout */}
                <div className="mt-6 flex gap-4 p-5 rounded-2xl border border-sky-500/20 bg-sky-500/5">
                  <span className="text-2xl shrink-0">⚠️</span>
                  <div>
                    <h4 className="text-sm font-syne font-bold text-sky-200 mb-1.5">What Happens If Your Code Crashes Mid-Run?</h4>
                    <p className="text-sm text-gray-400 leading-relaxed font-sans">
                      Data science is messy. If a cell throws an error during a Live Trace, GreenTrace doesn't give up — it catches the error safely, saves exact carbon metrics for every cell that <em>did</em> run, and highlights the failing cell with a{' '}
                      <span className="text-amber-400 font-bold">⚠ warning icon</span> in the dashboard. You still get a meaningful partial report.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </FadeSection>
        </section>

        {/* ── AI Section ─────────────────────────────────────────────────────── */}
        <section className="mb-24">
          <FadeSection>
            <div className="max-w-3xl mb-8">
              <p className="text-xs font-mono uppercase tracking-widest text-gray-600 mb-3">Intelligence Layer</p>
              <h2 className="text-3xl md:text-4xl font-syne font-bold text-white tracking-tight mb-5">
                AI-Powered Optimization,{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                  Not Just Tracking
                </span>
              </h2>
              <p className="text-gray-400 text-sm leading-relaxed font-sans">
                Tracking carbon is only half the battle — knowing how to reduce it is the ultimate goal. After evaluating your notebook, our AI engine analyzes the structural data through advanced integration and cross-references your specific coding layout against a robust database of sustainable software engineering practices.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-5">
              {[
                { title: 'Instant Summarization', desc: 'A clear, readable summary of your code\'s environmental efficiency, highlighting exact bottlenecks (e.g., "Your PyTorch training loop strategy is consuming 80% of total energy").' },
                { title: 'Actionable Optimizations', desc: 'Tailored, concrete recommendations — mixed-precision training, inefficient data loading fixes, specific hardware accelerator suggestions, and more.' },
                { title: 'Estimated Savings', desc: 'For every suggestion, the AI estimates potential energy savings so you can prioritize the easiest and most impactful changes before your next training epoch.' },
              ].map(({ title, desc }) => (
                <div key={title} className="p-6 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-purple-500/20 transition-all duration-300">
                  <h4 className="text-sm font-syne font-bold text-white mb-3">{title}</h4>
                  <p className="text-xs text-gray-500 leading-relaxed font-sans">{desc}</p>
                </div>
              ))}
            </div>
          </FadeSection>
        </section>

        {/* ── Export PDF section ─────────────────────────────────────────────── */}
        <section className="mb-24">
          <FadeSection>
            <div className="rounded-3xl border border-rose-500/20 bg-gradient-to-br from-rose-500/5 to-transparent p-8 md:p-12 relative overflow-hidden">
              <div className="absolute -bottom-16 -right-16 w-56 h-56 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="relative z-10 grid md:grid-cols-2 gap-8 items-center">
                <div>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center border border-rose-500/30 bg-rose-500/10">
                      <FileText size={16} className="text-rose-300" />
                    </div>
                    <span className="text-xs font-mono uppercase tracking-widest text-rose-400">Export & Report</span>
                  </div>
                  <h2 className="text-3xl font-syne font-bold text-white tracking-tight mb-4">
                    Audit-Ready PDF Reports
                  </h2>
                  <p className="text-gray-400 text-sm leading-relaxed font-sans">
                    Every completed analysis produces a downloadable PDF report. Designed to be shared with teams, institutions, or compliance bodies to demonstrate carbon-aware development practices.
                  </p>
                </div>
                <div className="space-y-3">
                  {[
                    'Full cell-by-cell CO₂ breakdown with CPU / RAM / GPU energy splits',
                    'Phase-level emission shares: Training vs. Testing vs. Other',
                    'Real-world equivalences — km driven, laptop hours, phone charges',
                    'Hardware metadata: CPU model, RAM, GPU, OS platform',
                    'Complete AI summary and all optimization recommendations ranked by impact',
                    'Accuracy notice and grid carbon intensity source for compliance',
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="w-5 h-5 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-rose-400 text-[9px] font-bold">✓</span>
                      </span>
                      <p className="text-sm text-gray-300 font-sans leading-relaxed">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </FadeSection>
        </section>

        {/* ── Infrastructure & Limitations ──────────────────────────────────────── */}
        <section className="mb-24">
          <FadeSection>
            <div className="text-center mb-12">
              <p className="text-xs font-mono uppercase tracking-widest text-gray-600 mb-3">Behind the Scenes</p>
              <h2 className="text-3xl md:text-4xl font-syne font-bold text-white tracking-tight">
                Our <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-sky-400">Infrastructure & Vision</span>
              </h2>
            </div>
          </FadeSection>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Current Infrastructure */}
            <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-8 relative overflow-hidden group hover:bg-white/[0.03] transition-colors">
              <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-[10px] font-mono uppercase tracking-widest">Free Public Tier</div>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center border border-white/10 bg-white/5 mb-6 group-hover:scale-110 transition-transform duration-300">
                <Globe size={20} className="text-gray-400" />
              </div>
              <h3 className="text-xl font-syne font-bold text-white mb-3">Shared Cloud Architecture</h3>
              <p className="text-sm text-gray-400 leading-relaxed font-sans mb-6">
                GreenTrace is built to democratize carbon-aware computing. The current public platform is deployed <strong className="text-gray-200">completely free of charge</strong>. Because we rely on shared, free-tier cloud environments to keep this accessible, we operate under necessary but strictly enforced limitations:
              </p>
              
              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 rounded-2xl bg-black/20 border border-white/5">
                  <Cpu className="text-gray-500 shrink-0 mt-0.5" size={16} />
                  <div>
                    <h4 className="text-sm font-semibold text-gray-300 mb-1">Sensor Restrictions</h4>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Cloud containers block direct access to raw motherboard hardware sensors (like GPU voltage or Intel RAPL) for security. We use accurate TDP-based CPU estimation as a highly reliable fallback.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4 p-4 rounded-2xl bg-black/20 border border-white/5">
                  <Activity className="text-gray-500 shrink-0 mt-0.5" size={16} />
                  <div>
                    <h4 className="text-sm font-semibold text-gray-300 mb-1">Compute Caps</h4>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Server CPU and RAM capacities are limited on shared infrastructure. To prevent timeout crashes, we strictly enforce a 1,000 file limit on attached datasets.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Enterprise Vision */}
            <div className="rounded-3xl border border-sky-500/20 bg-gradient-to-br from-sky-500/10 to-transparent p-8 relative overflow-hidden group hover:border-sky-500/30 transition-colors">
              <div className="absolute -top-16 -right-16 w-48 h-48 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-sky-500/15 border border-sky-500/25 text-sky-400 text-[10px] font-mono uppercase tracking-widest">Enterprise Vision</div>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center border border-sky-500/30 bg-sky-500/10 mb-6 group-hover:scale-110 transition-transform duration-300">
                <TrendingUp size={20} className="text-sky-300" />
              </div>
              <h3 className="text-xl font-syne font-bold text-white mb-3">Bare-Metal Precision</h3>
              <p className="text-sm text-gray-400 leading-relaxed font-sans mb-6">
                To bridge the gap between our robust estimations and absolute, enterprise-grade auditing precision, the next phase of GreenTrace involves dedicated physical hosting.
              </p>
              
              <div className="space-y-3 mb-6">
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-sky-500/20 border border-sky-500/30 flex items-center justify-center shrink-0 mt-0.5"><span className="text-sky-400 text-[9px] font-bold">✓</span></span>
                  <p className="text-sm text-gray-300 font-sans leading-relaxed">Hosting on paid <span className="text-white font-semibold">Bare-Metal Servers</span> rather than shared cloud zones.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-sky-500/20 border border-sky-500/30 flex items-center justify-center shrink-0 mt-0.5"><span className="text-sky-400 text-[9px] font-bold">✓</span></span>
                  <p className="text-sm text-gray-300 font-sans leading-relaxed">Unrestricted access to physical motherboard power sensors, mirroring exact local-machine accuracy.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-sky-500/20 border border-sky-500/30 flex items-center justify-center shrink-0 mt-0.5"><span className="text-sky-400 text-[9px] font-bold">✓</span></span>
                  <p className="text-sm text-gray-300 font-sans leading-relaxed">Every micro-gram of CO₂ reported would be 100% physically accurate and strictly auditable for ESG compliance.</p>
                </div>
              </div>
              
              <div className="pt-5 border-t border-white/5">
                <p className="text-xs text-gray-500 font-mono italic">
                  Until then, our free platform flawlessly highlights expensive code cells and generates brilliant AI optimization strategies to guide your baseline footprint.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ────────────────────────────────────────────────────────────── */}
        <section className="mb-24">
          <FadeSection>
            <div className="text-center mb-10">
              <p className="text-xs font-mono uppercase tracking-widest text-gray-600 mb-3">Got Questions?</p>
              <h2 className="text-3xl md:text-4xl font-syne font-bold text-white tracking-tight">
                Frequently Asked Questions
              </h2>
            </div>
            <div className="max-w-3xl mx-auto space-y-3">
              {faqs.map((f, i) => <FaqItem key={i} {...f} />)}
            </div>
          </FadeSection>
        </section>

        {/* ── CTA footer ─────────────────────────────────────────────────────── */}
        <FadeSection>
          <section className="text-center py-16 rounded-3xl border border-white/5 bg-white/[0.015] relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-purple-600/5 via-transparent to-green-600/5 pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600/5 rounded-full blur-[100px] pointer-events-none" />
            <div className="relative z-10">
              <p className="text-xs font-mono uppercase tracking-widest text-gray-600 mb-4">Ready to Start?</p>
              <h2 className="text-4xl md:text-5xl font-syne font-bold text-white tracking-tighter mb-5">
                Trace Your First<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-purple-400">Carbon Footprint</span>
              </h2>
              <p className="text-gray-500 font-sans text-sm max-w-md mx-auto mb-10">
                Upload your Jupyter Notebook, choose your analysis mode, and get a full environmental audit in minutes — completely free.
              </p>
              <button
                onClick={onBack}
                className="inline-flex items-center gap-3 px-10 py-4 rounded-2xl bg-white text-black font-syne font-bold text-base tracking-tight hover:bg-gray-100 hover:scale-[1.03] transition-all duration-300 shadow-[0_0_40px_rgba(255,255,255,0.12)]"
              >
                <Leaf size={18} />
                Start Analyzing
              </button>
            </div>
          </section>
        </FadeSection>

        {/* ── Footer ─────────────────────────────────────────────────────────── */}
        <div className="mt-16 pt-8 border-t border-white/5 text-center">
          <p className="text-[11px] text-gray-600 font-mono leading-relaxed">
            GreenTrace · Carbon-Aware Computing Platform · v1.0 · Built to democratize sustainable AI
          </p>
          <p className="text-[10px] text-gray-700 font-mono mt-2 max-w-3xl mx-auto">
            ⓘ Measurements use live kernel CPU profiling + TDP modelling. Results may vary ±10–30% between runs due to OS scheduling & background processes. Not intended for absolute compliance auditing on free infrastructure.
          </p>
        </div>

      </div>
    </div>
  );
}
