import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, Leaf, BookOpen, Cpu, FlaskConical, BarChart2,
  AlertTriangle, CheckCircle2, ChevronDown, Microscope, Brain, Zap
} from 'lucide-react';
import logo from '../assets/logo.png';

/* ─── Intersection observer hook ────────────────────────────────────────── */
function useInView(threshold = 0.1) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView];
}

/* ─── Fade-in section wrapper ────────────────────────────────────────────── */
function FadeSection({ children, className = '', delay = 0 }) {
  const [ref, inView] = useInView(0.08);
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

/* ─── Section heading ─────────────────────────────────────────────────────── */
function SectionHeading({ eyebrow, title, gradient = 'from-green-400 to-purple-400', centered = false }) {
  return (
    <div className={centered ? 'text-center mb-12' : 'mb-10'}>
      {eyebrow && (
        <p className="text-xs font-mono uppercase tracking-widest text-gray-600 mb-3">{eyebrow}</p>
      )}
      <h2 className="text-3xl md:text-4xl font-syne font-bold text-white tracking-tight">
        {typeof title === 'string'
          ? title
          : title.map((part, i) =>
              part.gradient
                ? <span key={i} className={`text-transparent bg-clip-text bg-gradient-to-r ${gradient}`}>{part.text}</span>
                : <span key={i}>{part.text}</span>
            )
        }
      </h2>
    </div>
  );
}

/* ─── Research image card ────────────────────────────────────────────────── */
function ResearchImage({ src, alt, caption }) {
  return (
    <div className="my-8 rounded-2xl overflow-hidden border border-white/5 bg-white/[0.02]">
      <img
        src={src}
        alt={alt}
        className="w-full object-contain"
        style={{ maxHeight: '420px' }}
        onError={e => { e.currentTarget.style.display = 'none'; }}
      />
      {caption && (
        <p className="text-xs font-mono text-gray-600 text-center px-4 py-3 border-t border-white/5 italic">{caption}</p>
      )}
    </div>
  );
}

/* ─── Insight callout box ────────────────────────────────────────────────── */
function InsightBox({ children, color = 'purple' }) {
  const colors = {
    purple: 'border-purple-500/20 bg-purple-500/5',
    green:  'border-green-500/20  bg-green-500/5',
    amber:  'border-amber-500/20  bg-amber-500/5',
    rose:   'border-rose-500/20   bg-rose-500/5',
    sky:    'border-sky-500/20    bg-sky-500/5',
  };
  return (
    <div className={`rounded-2xl border p-5 my-6 ${colors[color]}`}>
      {children}
    </div>
  );
}

/* ─── Key insight label ──────────────────────────────────────────────────── */
function KeyInsight({ children }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl border border-green-500/20 bg-green-500/5 my-4">
      <CheckCircle2 size={15} className="text-green-400 shrink-0 mt-0.5" />
      <p className="text-sm text-gray-300 font-sans leading-relaxed">{children}</p>
    </div>
  );
}

/* ─── Warning callout ────────────────────────────────────────────────────── */
function WarningBox({ children }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 my-4">
      <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
      <p className="text-sm text-gray-300 font-sans leading-relaxed">{children}</p>
    </div>
  );
}

/* ─── Experiment card ────────────────────────────────────────────────────── */
function ExperimentCard({ number, title, tagColor, borderColor, glowColor, bgColor, children }) {
  return (
    <div className={`relative rounded-3xl border ${borderColor} bg-white/[0.02] overflow-hidden group hover:bg-white/[0.035] transition-all duration-500`}>
      <div className={`absolute -top-16 -right-16 w-48 h-48 rounded-full ${glowColor} blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none`} />
      <div className="relative z-10 p-8">
        <div className="flex items-center gap-3 mb-6">
          <span className={`text-xs font-mono uppercase tracking-widest px-3 py-1 rounded-full border ${borderColor} ${tagColor} ${bgColor}`}>
            Setup {number}
          </span>
        </div>
        <h3 className="text-2xl font-syne font-bold text-white mb-6 tracking-tight">{title}</h3>
        {children}
      </div>
    </div>
  );
}

/* ─── Prose paragraph ────────────────────────────────────────────────────── */
function Para({ children }) {
  return <p className="text-sm text-gray-400 leading-relaxed font-sans mb-4">{children}</p>;
}

/* ─── Bullet list ────────────────────────────────────────────────────────── */
function BulletList({ items }) {
  return (
    <ul className="space-y-2 mb-4">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5 text-sm text-gray-300">
          <span className="text-purple-400 mt-0.5 shrink-0">›</span>
          <span className="font-sans leading-relaxed">{item}</span>
        </li>
      ))}
    </ul>
  );
}

/* ─── Numbered list ──────────────────────────────────────────────────────── */
function NumberedList({ items }) {
  return (
    <ol className="space-y-3 mb-4 list-none">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3 text-sm text-gray-300">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-[10px] font-bold flex items-center justify-center mt-0.5">
            {i + 1}
          </span>
          <span className="font-sans leading-relaxed">{item}</span>
        </li>
      ))}
    </ol>
  );
}

/* ─── Sub-label ──────────────────────────────────────────────────────────── */
function SubLabel({ children, color = 'text-gray-500' }) {
  return (
    <p className={`text-xs font-mono uppercase tracking-widest ${color} mb-3 mt-6`}>{children}</p>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   Main Research Component
   ════════════════════════════════════════════════════════════════════════════ */
export default function Research({ onBack }) {
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, []);

  const experiments = [
    {
      number: 1,
      title: 'Baseline: Original Dataset',
      tagColor: 'text-gray-300',
      borderColor: 'border-white/10',
      glowColor: 'bg-white/5',
      bgColor: 'bg-black/30',
      motivation: 'Before evaluating complex data-scaling techniques, we established a ground-truth baseline using exclusively the raw, unmanipulated original dataset of dementia MRI scans — training the image classifier with no synthetic pixels or augmented transformations.',
      bullets: [
        'Establishes a control paradigm with purely original, unaltered images.',
        'Highlights the intrinsic class imbalance inherent in raw medical datasets.',
        'Sets the absolute lowest carbon-emission floor against which all future computation is compared.',
      ],
      accuracyImages: [
        { src: '/research/3_image.png', alt: 'Baseline Accuracy Plots' },
        { src: '/research/4_image.png', alt: 'Baseline Console Logs' },
      ],
      carbonImage: { src: '/research/5_image.png', alt: 'Baseline Carbon Table' },
      insight: 'The baseline perfectly reflects raw model capability under real data constraints. Class imbalance — fewer severe-case MRI samples — causes lower sensitivity for minority classes. Carbon footprint is relatively low here because the dataset is physically smaller, but the model\'s diagnostic reliability suffers. Relying on raw, unbalanced medical data is clinically insufficient for scalable deployment.',
    },
    {
      number: 2,
      title: 'GAN on Entire Dataset',
      tagColor: 'text-rose-300',
      borderColor: 'border-rose-500/20',
      glowColor: 'bg-rose-500/15',
      bgColor: 'bg-black/30',
      motivation: 'To aggressively combat the class imbalance, a Generative Adversarial Network (GAN) was used to synthesize realistic MRI images for minority classes — injecting synthetic data universally into training, validation, and test sets.',
      bullets: [
        'GAN synthesizes diverse, high-resolution minority-class representations for equal class distribution.',
        'Synthetic data applied agnostically to all pipeline phases for volumetric normalization.',
      ],
      warning: 'GANs are powerful for general computer vision but carry profound risks in medical contexts. A GAN maps statistical distributions — it can produce images that look like brains to a classifier but contain subtle synthetic artifacts that contradict true human anatomy. Testing on synthetic medical data compromises clinical integrity by testing pattern recognition rather than genuine physiological markers.',
      accuracyImages: [
        { src: '/research/6_image.png', alt: 'GAN Entire No-FT Accuracy Plots', label: 'Without Fine-Tuning' },
        { src: '/research/7_image.png', alt: 'GAN Entire No-FT Console Logs', label: 'With Fine-Tuning' },
        { src: '/research/8_image.png', alt: 'GAN Entire FT Console Logs' },
      ],
      carbonImage: { src: '/research/9_image.png', alt: 'GAN Entire Dataset Carbon Table' },
      insight: 'GAN successfully mitigated class imbalance, but the operational trade-off proved steep. The carbon footprint increased exponentially — training both the GAN and the larger combined dataset consumed enormous GPU energy. Furthermore, evaluating against synthetic test instances fundamentally undermines clinical reliability. This approach traded data authenticity for statistical balance, masking deeper generalizability issues.',
    },
    {
      number: 3,
      title: 'GAN on Training Dataset Only',
      tagColor: 'text-amber-300',
      borderColor: 'border-amber-500/20',
      glowColor: 'bg-amber-500/15',
      bgColor: 'bg-black/30',
      motivation: 'Recognizing the ethical flaws of inflating validation metrics with synthetic data, this setup isolates GAN-generated images exclusively to the training phase — keeping validation and test sets strictly authentic.',
      bullets: [
        'Validation and test sets contain 100% real patient data, guaranteeing unbiased clinical evaluation.',
        'GAN is used solely as a data-inflation tool to improve training diversity.',
        'Closely mirrors a realistic, clinically acceptable deployment pipeline.',
      ],
      accuracyImages: [
        { src: '/research/10_image.png', alt: 'GAN Training Only No-FT Accuracy Plots', label: 'Without Fine-Tuning' },
        { src: '/research/11_image.png', alt: 'GAN Training Only No-FT Console Logs', label: 'With Fine-Tuning' },
        { src: '/research/12_image.png', alt: 'GAN Training Only FT Console Logs' },
      ],
      carbonImage: { src: '/research/13_image.png', alt: 'GAN Training Only Carbon Table' },
      insight: 'Clinical validity improved significantly by holding out real patient data for evaluation. However, the carbon footprint remained prohibitively high due to the immense generative training overhead. While we improved data reliability over Setup 2, the devastating environmental cost of running adversarial networks remained completely untackled.',
    },
    {
      number: 4,
      title: 'Classical Data Augmentation — Training Only',
      tagColor: 'text-green-300',
      borderColor: 'border-green-500/20',
      glowColor: 'bg-green-500/15',
      bgColor: 'bg-black/30',
      motivation: 'To directly address both the heavy energy cost and artificiality of GANs, we pivoted to classical data augmentation — randomized micro-rotations, subtle scaling, and contrast intensity shifts applied to pre-existing, authentic MRI scans.',
      bullets: [
        'Augmentation applies deterministic geometric transforms — never hallucinating new pixels.',
        'Every structural anomaly in a modified image remains grounded in a real patient\'s MRI topology.',
        'Absolutely critical for safety and regulatory acceptance of medical datasets.',
      ],
      accuracyImages: [
        { src: '/research/14_image.png', alt: 'Augmented Training Only No-FT Accuracy Plots', label: 'Without Fine-Tuning' },
        { src: '/research/15_image.png', alt: 'Augmented Training Only No-FT Console Logs', label: 'With Fine-Tuning' },
        { src: '/research/16_image.png', alt: 'Augmented Training Only FT Console Logs' },
      ],
      carbonImage: { src: '/research/17_image.png', alt: 'Augmented Training Only Carbon Table' },
      insight: 'Classical augmentation proved vastly superior in preserving unadulterated clinical authenticity — it introduces zero synthetic artifacts. The carbon footprint dropped significantly; applying rapid, deterministic mathematical transforms takes a minute fraction of the energy needed to train a deep generative network. This setup elegantly balanced expanded training diversity with aggressive carbon reduction.',
    },
    {
      number: 5,
      title: 'Classical Augmentation — Entire Dataset',
      tagColor: 'text-purple-300',
      borderColor: 'border-purple-500/20',
      glowColor: 'bg-purple-500/15',
      bgColor: 'bg-black/30',
      motivation: 'The final, most holistic setup safely applies classical augmentation across the entire dataset — training, validation, and test sets. Because geometric transforms maintain anatomical authenticity, they can be ethically applied without compromising clinical evaluation integrity.',
      bullets: [
        'Maximized data exposure without sacrificing real-world validity or data authenticity.',
        'Forces the network to learn scale- and rotation-invariant features — improving true generalization.',
        'Absolutely lowest carbon emission trajectory across all experimental setups.',
      ],
      accuracyImages: [
        { src: '/research/20_image.png', alt: 'Augmented Entire Dataset FT Console Logs', label: 'With Fine-Tuning' },
      ],
      carbonImage: { src: '/research/21_image.png', alt: 'Augmented Entire Dataset Carbon Table' },
      insight: 'This configuration conclusively yielded the best balance between classification performance and medical realism. Enriching the entire dataset via authentic structural transforms rather than synthetic hallucinations forced the model to learn critical invariant features. Compared to all previous setups, this methodology provided the most sound, generalizable accuracy while maintaining the most efficient, low-impact carbon footprint.',
      isBest: true,
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

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section className="pt-24 pb-20 relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-green-600/8 blur-[120px] pointer-events-none" />
          <div className="absolute top-20 right-1/4 w-[300px] h-[300px] rounded-full bg-purple-600/6 blur-[100px] pointer-events-none" />

          <div className="relative z-10 text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-green-500/30 bg-green-500/10 text-xs font-mono text-green-300 mb-8 animate-fade-in">
              <BookOpen size={11} />
              <span>RESEARCH · CARBON FOOTPRINTS IN ML</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-syne font-bold tracking-tighter text-white mb-6 leading-[0.95]">
              The Hidden Cost of
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-purple-400 to-purple-600">
                Intelligent Systems
              </span>
            </h1>

            <p className="text-lg md:text-xl text-gray-400 leading-relaxed max-w-2xl mx-auto font-sans">
              A deep-dive into carbon footprints in machine learning — from theory to empirical experiments
              on a dementia classification pipeline, tracking the real environmental cost of training modern AI.
            </p>
          </div>
        </section>

        {/* ── Part 1: What is a Carbon Footprint ────────────────────────────── */}
        <FadeSection>
          <section className="mb-20">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center border border-green-500/30 bg-green-500/10">
                <Leaf size={15} className="text-green-300" />
              </div>
              <p className="text-xs font-mono uppercase tracking-widest text-gray-600">Part 1</p>
            </div>
            <SectionHeading
              title={[{ text: 'What is a ' }, { text: 'Carbon Footprint?', gradient: true }]}
              gradient="from-green-400 to-teal-400"
            />

            <Para>
              Every time we run a line of code, send an email, or iterate over a massive dataset to train a deep neural
              network, electricity is consumed. A <strong className="text-white">carbon footprint</strong> represents the
              total amount of greenhouse gases — most commonly quantified as carbon dioxide equivalent (CO₂eq) — generated
              directly and indirectly by our actions.
            </Para>
            <Para>
              While we traditionally associate carbon emissions with heavy industries, aviation, and combustion engines,
              the digital world is a rapidly growing and often invisible contributor. The global technological infrastructure,
              powered by massive data centers, cooling systems, and computing networks, has a carbon footprint that rivals
              some physical industries.
            </Para>

            <div className="grid md:grid-cols-2 gap-6 my-8">
              <InsightBox color="green">
                <p className="text-xs font-mono uppercase tracking-widest text-green-400 mb-2">Direct Emissions (Operational)</p>
                <Para>
                  Electricity consumed by GPUs, CPUs, and memory during training and deployment of large-scale models,
                  plus the energy required to run massive cooling systems in data centers.
                </Para>
              </InsightBox>
              <InsightBox color="purple">
                <p className="text-xs font-mono uppercase tracking-widest text-purple-400 mb-2">Indirect Emissions (Embodied)</p>
                <Para>
                  Carbon emitted during the manufacturing, supply chain, transportation, and disposal of computing hardware.
                  Building a single high-performance GPU locks in a "carbon debt" before it's even plugged in.
                </Para>
              </InsightBox>
            </div>

            <InsightBox color="amber">
              <p className="text-xs font-mono uppercase tracking-widest text-amber-400 mb-2">The Scale of the Problem</p>
              <Para>
                Climate scientists estimate a limit of <strong className="text-white">2 tCO₂eq per person per year</strong> to
                keep global warming under the critical 1.5°C threshold. Astonishingly, training a single state-of-the-art AI
                model can sometimes emit <strong className="text-white">hundreds of tonnes of CO₂eq</strong> — making AI
                sustainability a non-negligible concern.
              </Para>
            </InsightBox>
          </section>
        </FadeSection>

        {/* ── Part 2: Carbon in ML/DL ───────────────────────────────────────── */}
        <FadeSection>
          <section className="mb-20">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center border border-purple-500/30 bg-purple-500/10">
                <Brain size={15} className="text-purple-300" />
              </div>
              <p className="text-xs font-mono uppercase tracking-widest text-gray-600">Part 2</p>
            </div>
            <SectionHeading
              title={[{ text: 'Carbon Footprint in ' }, { text: 'Machine Learning', gradient: true }]}
              gradient="from-purple-400 to-pink-400"
            />

            <Para>
              Machine Learning and Deep Learning have achieved remarkable milestones, revolutionizing fields from natural
              language processing to medical image analysis. However, this success comes at a steep environmental cost.
              As research in AI accelerates — deep learning papers grew from ~1,350 in 2015 to over <strong className="text-white">85,000 in 2022</strong> — the energy-intensive workloads required to push accuracy boundaries have seen immense growth.
            </Para>

            <h3 className="text-lg font-syne font-semibold text-white mb-4 mt-8">Why Deep Learning is So Energy-Intensive</h3>
            <div className="space-y-3 mb-8">
              {[
                { label: 'Massive Datasets & Parameters', desc: 'Modern neural networks contain billions of parameters requiring terabytes of training data. Passing this data through complex matrix multiplications requires millions of GPU hours.' },
                { label: 'Hyperparameter Tuning', desc: 'Models are rarely trained just once. Researchers conduct extensive optimization — tweaking learning rates, batch sizes, and architectures — often running the same massive training process hundreds of times.' },
                { label: 'Prolonged Training Times', desc: 'State-of-the-art models can require weeks or even months of continuous training on large arrays of specialized hardware accelerators.' },
              ].map(({ label, desc }) => (
                <div key={label} className="flex gap-4 p-4 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                  <div className="w-1 rounded-full bg-purple-500/50 shrink-0" />
                  <div>
                    <h4 className="text-sm font-syne font-bold text-white mb-1">{label}</h4>
                    <p className="text-xs text-gray-500 leading-relaxed font-sans">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <h3 className="text-lg font-syne font-semibold text-white mb-4">Measuring the Impact: Tracking Tools</h3>
            <ResearchImage
              src="/research/1_image.png"
              alt="Energy consumption tracking comparison"
              caption="Figure: Energy consumption recorded by different measurement methods over infrastructure types. (Source: Bouza et al., PMC10661046)"
            />
            <Para>
              The AI community has developed several tools to estimate this impact, such as <strong className="text-white">Carbontracker</strong>,{' '}
              <strong className="text-white">CodeCarbon</strong>, and <strong className="text-white">Eco2AI</strong>.
              Studies testing these tools reveal large variance — some measure the entire machine's consumption (acting like physical wattmeters),
              while others isolate the specific process. Machine-level tracking often provides a more rigorous approximation of true overhead, including memory and base system power.
            </Para>

            <InsightBox color="green">
              <p className="text-xs font-mono uppercase tracking-widest text-green-400 mb-2">The Rise of Green AI</p>
              <Para>
                This escalating energy demand has catalyzed a shift toward <strong className="text-white">"Green AI"</strong>.
                Unlike "Red AI" — which prioritizes state-of-the-art accuracy regardless of carbon cost — Green AI makes
                efficiency a primary evaluation metric. It asks the critical question:{' '}
                <em className="text-gray-300">Is an incremental 0.5% gain in accuracy worth a 200% increase in energy consumption?</em>
              </Para>
            </InsightBox>
          </section>
        </FadeSection>

        {/* ── Part 3: Cloud Computing ───────────────────────────────────────── */}
        <FadeSection>
          <section className="mb-20">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center border border-sky-500/30 bg-sky-500/10">
                <Cpu size={15} className="text-sky-300" />
              </div>
              <p className="text-xs font-mono uppercase tracking-widest text-gray-600">Part 3</p>
            </div>
            <SectionHeading
              title={[{ text: 'Role of ' }, { text: 'Cloud Computing', gradient: true }, { text: ' in Emissions' }]}
              gradient="from-sky-400 to-blue-500"
            />

            <Para>
              Very few researchers train large ML models on a laptop. Cloud computing has been the primary engine enabling rapid AI growth — but the cloud is built on massive, sprawling data centers packed with servers and GPUs running continuously.
            </Para>

            <div className="grid md:grid-cols-3 gap-4 my-8">
              {[
                { title: 'Power Usage Effectiveness', desc: 'PUE measures how much energy goes to actual computing versus overhead like cooling. Top-tier providers have driven PUE down significantly, but absolute energy consumed continues to skyrocket.', color: 'border-sky-500/20 bg-sky-500/5', text: 'text-sky-400' },
                { title: 'Geographic Location', desc: 'The marginal emissions data of the local power grid determines carbon intensity. Training in a coal-heavy region vs. a hydro/nuclear region can make a massive difference in total CO₂.', color: 'border-green-500/20 bg-green-500/5', text: 'text-green-400' },
                { title: 'Time-of-Day Scheduling', desc: 'Renewable energy is intermittent — solar and wind vary throughout the day. Scheduling workloads during off-peak hours when the grid is greener can meaningfully cut carbon intensity.', color: 'border-purple-500/20 bg-purple-500/5', text: 'text-purple-400' },
              ].map(({ title, desc, color, text }) => (
                <div key={title} className={`rounded-2xl border p-5 ${color}`}>
                  <h4 className={`text-xs font-mono uppercase tracking-widest ${text} mb-3`}>{title}</h4>
                  <p className="text-sm text-gray-400 leading-relaxed font-sans">{desc}</p>
                </div>
              ))}
            </div>

            <InsightBox color="sky">
              <p className="text-xs font-mono uppercase tracking-widest text-sky-400 mb-2">Dynamic Pausing</p>
              <Para>
                Innovative approaches include <strong className="text-white">dynamic pausing</strong>, where cloud instances
                automatically pause training when the marginal carbon intensity of the grid rises above a threshold, resuming
                only when the grid becomes greener. It is crucial for cloud providers to present clear, accessible information
                about Software Carbon Intensity (SCI) to help data scientists implement actionable, sustainable tactics.
              </Para>
            </InsightBox>
          </section>
        </FadeSection>

        {/* ── Part 4: Why It Matters ────────────────────────────────────────── */}
        <FadeSection>
          <section className="mb-20">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center border border-amber-500/30 bg-amber-500/10">
                <BarChart2 size={15} className="text-amber-300" />
              </div>
              <p className="text-xs font-mono uppercase tracking-widest text-gray-600">Part 4</p>
            </div>
            <SectionHeading
              title={[{ text: 'Why Reducing Carbon Footprint ' }, { text: 'Matters', gradient: true }]}
              gradient="from-amber-400 to-rose-400"
            />

            <Para>
              The tech industry's contribution to global emissions is growing at an unprecedented rate. While AI can monitor
              and improve environmental health across sectors, building increasingly complex AI models without considering
              computational cost risks undermining the very sustainability goals AI could help achieve.
            </Para>

            <ResearchImage
              src="/research/2_image.png"
              alt="D-CAIS Framework"
              caption="The D-CAIS Framework: a dual-governance mechanism to mitigate AI's environmental impact."
            />

            <Para>
              Reducing the digital carbon footprint is no longer optional — it is a core pillar of{' '}
              <strong className="text-white">ethical and responsible AI development</strong>. The carbon cost of computing
              disproportionately affects geographic regions most vulnerable to climate change.
            </Para>

            <div className="grid md:grid-cols-2 gap-5 my-8">
              {[
                { label: 'Internal Cycle', desc: 'Focused on technology-side decarbonization — improving computational efficiency at the hardware level, creating leaner algorithms, and reducing direct emissions from training clusters.', color: 'border-green-500/20 bg-green-500/5', text: 'text-green-400' },
                { label: 'External Cycle', desc: 'Focused on using AI to enable carbon reduction across other industries — creating an indirect emission offset loop to balance initial operational costs.', color: 'border-purple-500/20 bg-purple-500/5', text: 'text-purple-400' },
              ].map(({ label, desc, color, text }) => (
                <div key={label} className={`rounded-2xl border p-5 ${color}`}>
                  <p className={`text-xs font-mono uppercase tracking-widest ${text} mb-2`}>{label}</p>
                  <p className="text-sm text-gray-400 leading-relaxed font-sans">{desc}</p>
                </div>
              ))}
            </div>

            <InsightBox color="amber">
              <p className="text-xs font-mono uppercase tracking-widest text-amber-400 mb-2">The Accuracy vs. Efficiency Trade-off</p>
              <Para>
                Does a massive 0.2% improvement in image classification accuracy justify an architectural redesign that uses
                double the energy? Often, the answer is no. By prioritizing algorithms optimized for sustainability —
                through <strong className="text-white">quantization, knowledge distillation, low-rank adaptation</strong>, or
                simply choosing greener cloud regions — we can develop the next generation of AI responsibly.
              </Para>
            </InsightBox>
          </section>
        </FadeSection>

        {/* ── Part 5: Dataset Overview ──────────────────────────────────────── */}
        <FadeSection>
          <section className="mb-20">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center border border-rose-500/30 bg-rose-500/10">
                <Microscope size={15} className="text-rose-300" />
              </div>
              <p className="text-xs font-mono uppercase tracking-widest text-gray-600">Part 5</p>
            </div>
            <SectionHeading
              title={[{ text: 'Dementia Dataset ' }, { text: 'Overview', gradient: true }]}
              gradient="from-rose-400 to-pink-500"
            />

            <Para>
              To put Green AI, carbon tracking, and resource efficiency into practice, our experiments center around a highly
              relevant and computationally intensive application: <strong className="text-white">medical image classification</strong>.
              We utilize a dementia imaging dataset of MRI (Magnetic Resonance Imaging) scans — notoriously complex, large,
              and computationally taxing — making it the perfect real-world context for monitoring and optimizing operational
              carbon emissions throughout an ML pipeline.
            </Para>
            <Para>
              This is a <strong className="text-white">multi-class classification problem</strong>. The goal is for the model
              to identify subtle, early-stage structural changes in the brain (such as ventricular enlargement or hippocampal atrophy)
              that signify cognitive decline. The dataset is segregated into four progressive severity categories.
            </Para>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 my-10">
              {[
                { label: 'Non Demented', src: '/research/1_1_Dimentia.jpg.jpeg', desc: 'Healthy brain structures without noticeable atrophy indicative of dementia.', color: 'border-green-500/20 text-green-400' },
                { label: 'Very Mild Demented', src: '/research/1_2_Dimentia.jpg.jpeg', desc: 'Earliest, often subtle, signs of neurodegeneration that precede clinical diagnosis.', color: 'border-yellow-500/20 text-yellow-400' },
                { label: 'Mild Demented', src: '/research/1_3_Dimentia.jpg.jpeg', desc: 'Clear visible changes in brain volume correlating with mild cognitive impairment.', color: 'border-amber-500/20 text-amber-400' },
                { label: 'Moderate Demented', src: '/research/1_4_Dimentia.jpg.jpeg', desc: 'Severe structural loss and significant ventricle expansion, characteristic of advanced dementia.', color: 'border-rose-500/20 text-rose-400' },
              ].map(({ label, src, desc, color }) => (
                <div key={label} className={`rounded-2xl border ${color.split(' ')[0]} bg-white/[0.02] overflow-hidden`}>
                  <div className="aspect-square overflow-hidden bg-black/30">
                    <img src={src} alt={label} className="w-full h-full object-cover opacity-80" />
                  </div>
                  <div className="p-4">
                    <p className={`text-xs font-mono uppercase tracking-widest ${color.split(' ')[1]} mb-1.5`}>{label}</p>
                    <p className="text-xs text-gray-500 leading-relaxed font-sans">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </FadeSection>

        {/* ── Experiments ───────────────────────────────────────────────────── */}
        <FadeSection>
          <section className="mb-20">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center border border-purple-500/30 bg-purple-500/10">
                <FlaskConical size={15} className="text-purple-300" />
              </div>
              <p className="text-xs font-mono uppercase tracking-widest text-gray-600">Experiments & Analysis</p>
            </div>
            <SectionHeading
              title={[{ text: 'Five Experimental ' }, { text: 'Setups', gradient: true }]}
              gradient="from-purple-400 to-green-400"
            />
            <Para>
              We designed a comprehensive series of experimental setups spanning the lifecycle of a convolutional neural
              network trained for dementia classification — rigorously understanding how different data preparation strategies
              and algorithmic choices influence both diagnostic performance and environmental cost.
            </Para>
            <Para>Four critical dimensions are explored across all experiments:</Para>
            <div className="grid md:grid-cols-2 gap-3 mb-12">
              {[
                'Data Quality vs. Synthetic Data: Classical augmentation vs. GANs for class imbalance.',
                'Accuracy vs. Carbon Footprint: Exact environmental cost of fractional accuracy gains.',
                'Impact of Fine-Tuning: Transfer Learning vs. training from scratch.',
                'Ethical Considerations: Balancing data diversity with risks of hallucinated medical artifacts.',
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                  <span className="w-5 h-5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                  <p className="text-sm text-gray-400 leading-relaxed font-sans">{item}</p>
                </div>
              ))}
            </div>
          </section>
        </FadeSection>

        {/* ── Individual experiment cards ────────────────────────────────────── */}
        <div className="space-y-10 mb-24">
          {experiments.map((exp, i) => (
            <FadeSection key={exp.number} delay={i * 60}>
              <ExperimentCard
                number={exp.number}
                title={exp.title}
                tagColor={exp.tagColor}
                borderColor={exp.borderColor}
                glowColor={exp.glowColor}
                bgColor={exp.bgColor}
              >
                {exp.isBest && (
                  <div className="inline-flex items-center gap-2 px-3 py-1's rounded-full border border-green-400/30 bg-green-400/10 text-green-300 text-xs font-mono mb-5">
                    ✦ Best Overall Configuration
                  </div>
                )}

                <SubLabel color="text-gray-600">Motivation</SubLabel>
                <Para>{exp.motivation}</Para>

                <SubLabel color="text-gray-600">Key Design Choices</SubLabel>
                <BulletList items={exp.bullets} />

                {exp.warning && (
                  <WarningBox>{exp.warning}</WarningBox>
                )}

                <SubLabel color="text-gray-600">Accuracy Results</SubLabel>
                {exp.accuracyImages.map((img, j) => (
                  <div key={j}>
                    {img.label && <p className="text-xs font-mono text-gray-600 mb-2 uppercase tracking-widest">{img.label}</p>}
                    <ResearchImage src={img.src} alt={img.alt} />
                  </div>
                ))}

                <SubLabel color="text-gray-600">Carbon Footprint</SubLabel>
                <ResearchImage src={exp.carbonImage.src} alt={exp.carbonImage.alt} />

                <div className="mt-4 pt-5 border-t border-white/5">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-gray-600 mb-3">Key Insight</p>
                  <p className="text-sm text-gray-300 leading-relaxed font-sans">{exp.insight}</p>
                </div>
              </ExperimentCard>
            </FadeSection>
          ))}
        </div>

        {/* ── Final Conclusion ──────────────────────────────────────────────── */}
        <FadeSection>
          <section className="mb-24">
            <div className="rounded-3xl border border-green-500/20 bg-gradient-to-br from-green-500/5 via-transparent to-purple-500/5 p-8 md:p-12 relative overflow-hidden">
              <div className="absolute -top-16 -right-16 w-64 h-64 bg-green-500/8 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-purple-500/8 rounded-full blur-3xl pointer-events-none" />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center border border-green-500/30 bg-green-500/10">
                    <CheckCircle2 size={16} className="text-green-300" />
                  </div>
                  <div>
                    <p className="text-xs font-mono uppercase tracking-widest text-gray-600">Summary</p>
                    <h2 className="text-2xl font-syne font-bold text-white tracking-tight">Final Conclusions</h2>
                  </div>
                </div>

                <div className="space-y-3">
                  {[
                    { text: 'The fully augmented dataset performs the best overall — yielding robust, generalizable classification metrics without delegitimizing the underlying medical reality of the organic MRI scans.', color: 'border-green-500/25 bg-green-500/5', mark: 'text-green-400' },
                    { text: 'Strategic fine-tuning consistently improves both diagnostic accuracy and overarching computational efficiency — definitively the most viable strategy for sustainable, Green AI development.', color: 'border-purple-500/25 bg-purple-500/5', mark: 'text-purple-400' },
                    { text: 'GANs introduce severe clinical risks in medical datasets — hallucinating clinical features can lead to fundamentally faulty diagnostic tools, all while creating a massive, unnecessary spike in carbon emissions.', color: 'border-rose-500/25 bg-rose-500/5', mark: 'text-rose-400' },
                    { text: 'Classical transformative augmentation preserves data integrity while operating at a far cheaper energy threshold — effectively sidestepping the massive environmental toll of heavy generative models.', color: 'border-sky-500/25 bg-sky-500/5', mark: 'text-sky-400' },
                    { text: 'The optimal approach for balancing clinical efficiency and environmental sustainability: Classical Data Augmentation closely coupled with Model Fine-Tuning.', color: 'border-amber-500/25 bg-amber-500/5', mark: 'text-amber-400' },
                  ].map(({ text, color, mark }, i) => (
                    <div key={i} className={`flex items-start gap-4 p-4 rounded-2xl border ${color}`}>
                      <span className={`${mark} shrink-0 font-bold text-lg leading-none mt-0.5`}>✦</span>
                      <p className="text-sm text-gray-300 leading-relaxed font-sans">{text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </FadeSection>

        {/* ── Key Takeaways ─────────────────────────────────────────────────── */}
        <FadeSection>
          <section className="mb-24">
            <div className="text-center mb-10">
              <p className="text-xs font-mono uppercase tracking-widest text-gray-600 mb-3">For Practitioners</p>
              <h2 className="text-3xl md:text-4xl font-syne font-bold text-white tracking-tight">
                Key <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-rose-400">Takeaways</span>
              </h2>
            </div>
            <div className="grid md:grid-cols-3 gap-5">
              {[
                { icon: BarChart2, title: 'Accuracy Alone is Insufficient', body: 'In the modern era of deep learning, evaluating a diagnostic model purely on accuracy is short-sighted. Developers must actively calculate, consider, and mitigate the resulting operational carbon footprint.', color: 'border-amber-500/20 bg-amber-500/5', icon_c: 'text-amber-300', icon_bg: 'border-amber-500/30 bg-amber-500/10' },
                { icon: Microscope, title: 'Data Authenticity in Healthcare AI', body: 'Synthetic data might balance an unbalanced spreadsheet, but in the highly sensitive clinical domain, structural authenticity directly represents real human lives and factual pathologies.', color: 'border-rose-500/20 bg-rose-500/5', icon_c: 'text-rose-300', icon_bg: 'border-rose-500/30 bg-rose-500/10' },
                { icon: Leaf, title: 'Sustainable AI Requires Balance', body: 'The future of medical AI requires practitioners to carefully weigh the trade-offs between striving for maximum algorithmic performance versus the resulting global environmental impact of that ambition.', color: 'border-green-500/20 bg-green-500/5', icon_c: 'text-green-300', icon_bg: 'border-green-500/30 bg-green-500/10' },
              ].map(({ icon: Icon, title, body, color, icon_c, icon_bg }) => (
                <div key={title} className={`rounded-3xl border p-7 ${color} flex flex-col gap-4`}>
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${icon_bg}`}>
                    <Icon size={16} className={icon_c} />
                  </div>
                  <h3 className="text-base font-syne font-bold text-white tracking-tight">{title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed font-sans">{body}</p>
                </div>
              ))}
            </div>
          </section>
        </FadeSection>

        {/* ── CTA Footer ────────────────────────────────────────────────────── */}
        <FadeSection>
          <section className="text-center py-16 rounded-3xl border border-white/5 bg-white/[0.015] relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-green-600/5 via-transparent to-purple-600/5 pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-green-600/5 rounded-full blur-[100px] pointer-events-none" />
            <div className="relative z-10">
              <p className="text-xs font-mono uppercase tracking-widest text-gray-600 mb-4">Put the Research into Practice</p>
              <h2 className="text-4xl md:text-5xl font-syne font-bold text-white tracking-tighter mb-5">
                Measure Your Own<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-purple-400">Carbon Footprint</span>
              </h2>
              <p className="text-gray-500 font-sans text-sm max-w-md mx-auto mb-10">
                Upload your Jupyter Notebook. GreenTrace applies the same measurement principles studied in this research
                to your own code — completely free.
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

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <div className="mt-16 pt-8 border-t border-white/5 text-center">
          <p className="text-[11px] text-gray-600 font-mono leading-relaxed">
            GreenTrace Research · Carbon-Aware Computing Platform · v1.0 · Mar 31, 2026 · 20 min read
          </p>
          <p className="text-[10px] text-gray-700 font-mono mt-2 max-w-3xl mx-auto">
            ⓘ Research content based on empirical experiments with CNN dementia classification. Carbon measurements use live kernel CPU profiling + TDP modelling. Results may vary ±10–30% between runs due to OS scheduling & background processes.
          </p>
        </div>

      </div>
    </div>
  );
}
