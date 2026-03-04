import React, { useState } from 'react';
import { api } from '../api';
import { Upload, ChevronLeft, Database, Settings2, Sliders, Info, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AdminUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [chunkSize, setChunkSize] = useState(1000);
  const [chunkOverlap, setChunkOverlap] = useState(200);
  const [temperature, setTemperature] = useState(0.0);
  const [isIngesting, setIsIngesting] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

  const globalApiKey = localStorage.getItem('VORTEX_API_KEY') || '';

  const handleIngest = async () => {
    if (!file || !globalApiKey) {
      alert("Missing file or authorization.");
      return;
    }

    setIsIngesting(true);
    setStatus(null);
    try {
      await api.adminIngestKnowledge(file, globalApiKey, chunkSize, chunkOverlap, temperature);
      setStatus({ type: 'success', msg: `Successfully vectorized ${file.name}` });
      setFile(null);
    } catch (err) {
      setStatus({ type: 'error', msg: 'Vortex Ingestion Failed. Check proxy status.' });
    } finally {
      setIsIngesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#e2e2e2] font-sans selection:bg-[#00f2ff]/30 p-6 lg:p-12">
      <div className="max-w-4xl mx-auto">
        {/* Navigation */}
        <Link to="/" className="inline-flex items-center gap-2 text-[#4a4a6a] hover:text-[#00f2ff] transition-colors mb-12 group">
          <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-xs font-bold uppercase tracking-widest">Back to Terminal</span>
        </Link>

        <header className="mb-12">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#00f2ff] to-[#7000ff] flex items-center justify-center shadow-lg">
              <Database size={24} className="text-[#0a0a0f]" />
            </div>
            <h1 className="text-4xl font-bold tracking-tighter">Knowledge Base <span className="text-[#4a4a6a]">Ingestion</span></h1>
          </div>
          <p className="text-[#8e8eaf] max-w-xl">
            Populate the organizational playground intelligence. Upload documents to be parsed, chunked, and vectorized into ChromaDB.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Upload Area */}
          <div className="lg:col-span-2 space-y-6">
            <div className={`relative border-2 border-dashed rounded-3xl p-12 transition-all flex flex-col items-center justify-center text-center ${file ? 'border-[#00f2ff] bg-[#00f2ff]/5' : 'border-[#1f1f2e] hover:border-[#4a4a6a]'}`}>
              <input 
                type="file" 
                className="absolute inset-0 opacity-0 cursor-pointer" 
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                accept=".pdf,.txt,.py,.java,.js,.ts,.md"
              />
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-6 ${file ? 'bg-[#00f2ff] text-[#0a0a0f]' : 'bg-[#12121e] text-[#4a4a6a]'}`}>
                <Upload size={32} />
              </div>
              {file ? (
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">{file.name}</h3>
                  <p className="text-xs text-[#00f2ff] uppercase tracking-widest font-mono">Ready for Vectorization</p>
                </div>
              ) : (
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">Drop local intelligence here</h3>
                  <p className="text-sm text-[#4a4a6a]">Supports PDF, TXT, and Source Code files</p>
                </div>
              )}
            </div>

            {status && (
              <div className={`p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${status.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
                {status.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
                <span className="text-sm font-medium">{status.msg}</span>
              </div>
            )}

            <button 
              onClick={handleIngest}
              disabled={!file || isIngesting}
              className="w-full py-5 bg-gradient-to-r from-[#00f2ff] to-[#7000ff] text-[#0a0a0f] font-bold rounded-2xl shadow-xl active:scale-[0.98] transition-all disabled:opacity-20 flex items-center justify-center gap-3 tracking-[0.2em] uppercase text-sm"
            >
              {isIngesting ? <Loader2 className="animate-spin" size={20} /> : <Database size={20} />}
              {isIngesting ? 'Processing Intelligence...' : 'Initialize Ingestion'}
            </button>
          </div>

          {/* Parameters Sidebar */}
          <div className="space-y-6">
            <div className="bg-[#12121e] border border-[#1f1f2e] rounded-3xl p-6">
              <div className="flex items-center gap-2 text-[#00f2ff] mb-6">
                <Settings2 size={18} />
                <span className="text-[10px] font-bold uppercase tracking-widest">Ingestion Specs</span>
              </div>

              <div className="space-y-8">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-xs font-medium text-[#8e8eaf]">Chunk Size</label>
                    <span className="text-[10px] font-mono text-[#00f2ff] bg-[#00f2ff]/10 px-2 py-0.5 rounded">{chunkSize} tokens</span>
                  </div>
                  <input 
                    type="range" min="200" max="4000" step="100" 
                    value={chunkSize} onChange={(e) => setChunkSize(parseInt(e.target.value))}
                    className="w-full accent-[#00f2ff]"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-xs font-medium text-[#8e8eaf]">Overlap</label>
                    <span className="text-[10px] font-mono text-[#7000ff] bg-[#7000ff]/10 px-2 py-0.5 rounded">{chunkOverlap} tokens</span>
                  </div>
                  <input 
                    type="range" min="0" max="1000" step="50" 
                    value={chunkOverlap} onChange={(e) => setChunkOverlap(parseInt(e.target.value))}
                    className="w-full accent-[#7000ff]"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-xs font-medium text-[#8e8eaf]">Temperature</label>
                    <span className="text-[10px] font-mono text-white bg-[#1f1f2e] px-2 py-0.5 rounded">{temperature.toFixed(1)}</span>
                  </div>
                  <input 
                    type="range" min="0" max="1" step="0.1" 
                    value={temperature} onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full accent-[#4a4a6a]"
                  />
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-[#1f1f2e] flex items-start gap-3">
                <Info size={16} className="text-[#4a4a6a] flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-[#4a4a6a] leading-relaxed uppercase tracking-tighter">
                  Higher chunk sizes allow for broader context but may exceed model attention spans. Overlap ensures semantic continuity.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}