import React, { useState } from 'react';
import axios from 'axios';
import Landing from './components/Landing';
import UploadZone from './components/UploadZone';
import Dashboard from './components/Dashboard';
import CustomCursor from './components/CustomCursor';
import AboutUs from './components/AboutUs';
import Research from './components/Research';
import logo from './assets/logo.png';


function App() {
  const [showLanding, setShowLanding] = useState(true);
  const [showAbout, setShowAbout] = useState(false);
  const [showResearch, setShowResearch] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleAnalyze = async (payload) => {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('notebook', payload.notebook);
      
      if (payload.dataset && payload.dataset.length > 0) {
        const paths = [];
        payload.dataset.forEach(file => {
          formData.append('dataset', file);
          const path = file.webkitRelativePath || file.name;
          paths.push(path);
        });
        formData.append('dataset_paths', JSON.stringify(paths));
      }
      
      formData.append('region', payload.region);
      formData.append('run_live', payload.runLive);

      const response = await axios.post('http://localhost:8000/api/analyze', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data.status === 'processing') {
        const jobId = response.data.job_id;
        
        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await axios.get(`http://localhost:8000/api/status/${jobId}`);
            const jobData = statusRes.data;
            
            if (jobData.status === 'completed') {
              clearInterval(pollInterval);
              setResult(jobData.result);
              setLoading(false);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            } else if (jobData.status === 'failed') {
              clearInterval(pollInterval);
              setError(jobData.error || "Execution failed.");
              setLoading(false);
            }
          } catch (pollErr) {
            clearInterval(pollInterval);
            setError("Polling failed: " + pollErr.message);
            setLoading(false);
          }
        }, 3000);

        // Do not clear loading yet!
      } else if (response.data.status === 'completed') {
        setResult(response.data.result);
        setLoading(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        // Fallback for older interface
        setResult(response.data);
        setLoading(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }

    } catch (err) {
      console.error(err);
      
      let errMsg = "An unexpected error occurred computing the footprint.";
      if (err.response?.data?.detail) {
        const detail = err.response.data.detail;
        errMsg = typeof detail === 'object' ? JSON.stringify(detail, null, 2) : detail;
      } else if (err.message) {
        errMsg = err.message;
      }
      
      setError(errMsg);
      setLoading(false);
    }
  };

  // Research page
  if (showResearch) {
    return (
      <>
        <CustomCursor />
        <Research onBack={() => setShowResearch(false)} />
      </>
    );
  }

  // About Us page
  if (showAbout) {
    return (
      <>
        <CustomCursor />
        <AboutUs onBack={() => setShowAbout(false)} />
      </>
    );
  }

  if (showLanding) {
    return (
      <>
        <CustomCursor />
        <div className="min-h-screen overflow-hidden flex items-center justify-center p-4" style={{ backgroundColor: '#030303' }}>
          <div className="app-shell w-full max-w-7xl relative mx-auto h-[90vh]">
            <Landing
              onProceed={() => setShowLanding(false)}
              onAbout={() => setShowAbout(true)}
              onResearch={() => setShowResearch(true)}
            />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <CustomCursor />
      <div className="min-h-screen overflow-hidden flex flex-col items-center py-10 px-4" style={{ backgroundColor: '#030303' }}>
        <div className="app-shell w-full max-w-7xl min-h-[90vh] flex flex-col relative z-10 px-4 py-8 md:px-12 md:py-16">
          <div className="flex items-center justify-between mb-12 border-b border-white/5 pb-6">
            <div
              className="flex items-center space-x-3 hover:opacity-80 transition-all duration-300 group"
              style={{ cursor: 'none' }}
              onClick={() => { setResult(null); setShowLanding(true); }}
            >
              <div className="relative">
                <div className="absolute -inset-1 bg-green-500/20 rounded-full blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
                <img
                  src={logo}
                  alt="GreenTrace Logo"
                  className="relative w-9 h-9 object-contain shadow-2xl transition-transform duration-500 group-hover:scale-110"
                />
              </div>
              <h1 className="text-2xl font-bold font-syne text-white tracking-tight">GreenTrace</h1>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowResearch(true)}
                className="text-sm font-medium text-gray-500 hover:text-gray-300 transition-colors"
              >
                Research
              </button>
              <button
                onClick={() => setShowAbout(true)}
                className="text-sm font-medium text-gray-500 hover:text-gray-300 transition-colors"
              >
                About Us
              </button>
              {result && (
                <button
                  onClick={() => setResult(null)}
                  className="text-sm font-medium text-gray-400 hover:text-white transition-colors"
                >
                  Analyze New Project
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 text-red-200 rounded-2xl animate-fade-in max-w-4xl mx-auto">
              <strong className="font-bold flex items-center mb-2">Analysis Failed</strong>
              <pre className="text-xs font-mono whitespace-pre-wrap">{error}</pre>
            </div>
          )}

          <div className="flex-1 flex flex-col h-full w-full">
            {!result ? (
              <UploadZone onAnalyze={handleAnalyze} loading={loading} />
            ) : (
              <Dashboard data={result} />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default App;

