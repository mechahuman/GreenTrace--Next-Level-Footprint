import React from 'react';
import FluidSimulation from './FluidSimulation';

export default function Landing({ onProceed, onAbout, onResearch }) {
  return (
    <div className="flex flex-col md:flex-row w-full h-[85vh] animate-fade-in relative overflow-hidden">
      
      {/* Left Vertical Branding */}
      <div className="hidden md:flex flex-col justify-end p-8 border-r border-white/5 w-24 flex-shrink-0 z-10">
        <h1
          className="text-4xl font-syne font-bold tracking-widest mb-12 select-none"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          <span className="bg-clip-text text-transparent bg-gradient-to-t from-accent2 via-white to-white drop-shadow-[0_0_15px_rgba(168,85,247,0.3)] whitespace-nowrap">
            GreenTrace
          </span>
        </h1>
        <div className="w-full flex justify-center mb-auto pt-4">
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative flex flex-col justify-center items-center overflow-hidden p-8">
        
        {/* ✦ High-Fidelity WebGL Fluid Simulation */}
        <FluidSimulation />

        {/* Floating ambient numbers */}
        <div className="absolute inset-0 z-0 pointer-events-none select-none">
          <span className="absolute top-[18%] left-[38%] text-xs font-mono text-white/20">171</span>
          <span className="absolute top-[28%] right-[22%] text-xs font-mono text-white/20">95</span>
          <span className="absolute bottom-[42%] left-[22%] text-xs font-mono text-white/20">52</span>
          <span className="absolute bottom-[26%] right-[28%] text-xs font-mono text-white/20">31</span>
          <span className="absolute bottom-[12%] left-[42%] text-xs font-mono text-white/20">64</span>
          <span className="absolute bottom-[22%] left-[28%] text-xs font-mono text-white/20">80</span>
        </div>

        {/* Top Right Buttons */}
        <div className="absolute top-8 right-8 z-20 flex gap-3 items-center">
          
          <button
            onClick={onResearch}
            className="px-5 py-2.5 rounded-lg text-sm font-mono font-medium text-gray-300 hover:text-white transition-all
              bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20"
          >
            Research
          </button>
          <button
            onClick={onAbout}
            className="px-5 py-2.5 rounded-lg text-sm font-mono font-medium text-gray-300 hover:text-white transition-all
              bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20"
          >
            About Us
          </button>
          <button
            onClick={onProceed}
            className="px-6 py-2.5 rounded-lg text-sm font-mono text-white transition-all
              bg-purple-800/60 hover:bg-purple-600/80 border border-purple-500/30 hover:border-purple-400/60
              shadow-[0_0_20px_rgba(168,85,247,0.2)] hover:shadow-[0_0_30px_rgba(168,85,247,0.4)]"
          >
            Start Analyzing
          </button>
        </div>

        {/* Sub-tag line top left */}
        <div className="absolute top-1/4 left-10 z-10 text-right opacity-80 max-w-[200px] pointer-events-none">
          <p className="text-purple-400 text-sm">Tailored Compute</p>
          <p className="text-purple-400/60 text-sm">Emissions, Traced by AI</p>
        </div>

        {/* Main hero text — bottom right */}
        <div className="mt-auto mb-16 md:mb-0 md:absolute md:top-1/2 md:right-10 md:-translate-y-1/2 text-right z-10 pointer-events-none">
          <h2 className="text-6xl md:text-[5.5rem] leading-[0.9] font-syne font-bold tracking-tighter text-white mb-2">
            Next-Level<br />
            <span className="text-gray-400">Footprint</span>
          </h2>
          <p className="text-gray-600 font-mono text-xs max-w-xs ml-auto mt-6 leading-relaxed">
            Upload your Jupyter notebook and dataset.<br/>
            GreenTrace will analyze the runtime context<br/>
            and create a carbon emission report for you.
          </p>
        </div>

        {/* Mobile CTA */}
        <div className="mt-12 mx-auto md:hidden z-10 flex flex-col gap-3 items-center">
          <button
            onClick={onProceed}
            className="flex items-center px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-white font-medium transition-all"
          >
            Analyze Project →
          </button>
          <div className="flex gap-4">
            <button
              onClick={onResearch}
              className="flex items-center px-6 py-3 text-gray-400 hover:text-white text-sm transition-colors"
            >
              Research
            </button>
            <button
              onClick={onAbout}
              className="flex items-center px-6 py-3 text-gray-400 hover:text-white text-sm transition-colors"
            >
              About Us
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
