import React, { useState, useEffect, useRef } from 'react';
import { api, MOCK_CONFIG, setBackendType, getBackendType, BackendType } from './api';
import { Plus, MessageSquare, Send, Paperclip, Settings, Loader2, Bot, User, Code, Building, RefreshCw, X, Sparkles, Terminal, LogOut, Key, AlertTriangle, MoreVertical, Edit2, Trash2, Mic, MicOff, Copy, Check, Database, FileText, Image as ImageIcon, Cpu, Zap, ShieldCheck } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Routes, Route, Link } from 'react-router-dom';
import AdminUpload from './pages/AdminUpload';

type Session = { id?: string; name?: string; model: string; mode: string; created_at: string; is_mock: boolean };
type Message = { id?: number; role: string; content: string; timestamp?: string };

function ChatPlatform() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Global State
  const [globalApiKey, setGlobalApiKey] = useState<string>(localStorage.getItem('VORTEX_API_KEY') || '');
  const [isSetupComplete, setIsSetupComplete] = useState<boolean>(!!localStorage.getItem('VORTEX_API_KEY'));
  const [backendType, setBackendTypeState] = useState<BackendType>(getBackendType());

  // Modals
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isInitialSetupOpen, setIsInitialSetupOpen] = useState(!isSetupComplete);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // New Chat Modal State
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedMode, setSelectedMode] = useState('code');
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  // Settings Modal State
  const [newApiKey, setNewApiKey] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [isUpdatingKey, setIsUpdatingKey] = useState(false);

  // Action State
  const [sessionToAction, setSessionToAction] = useState<Session | null>(null);
  const [newName, setNewName] = useState('');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  useEffect(() => {
    if (isSetupComplete && globalApiKey) {
      loadSessions();
      loadModels();
    }
  }, [isSetupComplete, globalApiKey, backendType]);

  useEffect(() => {
    if (activeSession?.id) {
      loadMessages(activeSession.id);
    } else if (!activeSession) {
      setMessages([]);
    }
  }, [activeSession?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending, isTranscribing]);

  // PROTECTION GATEWAY
  const protectedAction = (action: () => void) => {
    if (!isSetupComplete || !globalApiKey) {
      setIsInitialSetupOpen(true);
    } else {
      action();
    }
  };

  const loadSessions = async () => {
    try {
      const data = await api.getSessions(globalApiKey);
      setSessions(data);
    } catch (err) {
      console.error('Failed to load sessions', err);
    }
  };

  const loadModels = async () => {
    try {
      const models = await api.fetchModels(globalApiKey);
      setAvailableModels(models);
    } catch (err) {
      console.error('Failed to load models', err);
    }
  };

  const loadMessages = async (sessionId: string) => {
    try {
      const data = await api.getMessages(sessionId);
      setMessages(data);
    } catch (err) {
      console.error('Failed to load messages', err);
    }
  };

  const handleInitialSetup = async () => {
    setIsUpdatingKey(true);
    try {
      const keyToStore = MOCK_CONFIG.enabled ? (newApiKey || 'MOCK_KEY') : newApiKey;
      setBackendType(backendType);
      const models = await api.fetchModels(keyToStore);
      if (models.length > 0) {
        localStorage.setItem('VORTEX_API_KEY', keyToStore);
        setGlobalApiKey(keyToStore);
        setAvailableModels(models);
        setIsSetupComplete(true);
        setIsInitialSetupOpen(false);
        setNewApiKey('');
      }
    } catch (err) {
      alert('Verification Failed. Ensure the selected engine is running.');
    } finally {
      setIsUpdatingKey(false);
    }
  };

  const handleUpdateSettings = () => {
    if (confirmText.toUpperCase() !== 'YES') {
      alert('Type YES to confirm changes.');
      return;
    }
    if (newApiKey) {
      localStorage.setItem('VORTEX_API_KEY', newApiKey);
      setGlobalApiKey(newApiKey);
    }
    setBackendType(backendType);
    setActiveSession(null);
    setMessages([]);
    setSessions([]);
    setIsSettingsModalOpen(false);
    setConfirmText('');
    setNewApiKey('');
    alert('Vortex Engine Reconfigured.');
  };

  const handleDeleteApiKey = () => {
    if (confirmText.toUpperCase() !== 'YES') {
      alert('Please type YES to confirm deletion.');
      return;
    }
    localStorage.removeItem('VORTEX_API_KEY');
    setGlobalApiKey('');
    setIsSetupComplete(false);
    setActiveSession(null);
    setMessages([]);
    setSessions([]);
    setIsSettingsModalOpen(false);
    setIsInitialSetupOpen(true);
    setConfirmText('');
    alert('API Key deleted.');
  };

  const handleOpenNewChat = async () => {
    setIsNewChatModalOpen(true);
    if (availableModels.length === 0) {
      setIsLoadingModels(true);
      try {
        const models = await api.fetchModels(globalApiKey);
        setAvailableModels(models);
        if (models.length > 0) setSelectedModel(models[0]);
      } catch (err) {
        console.error('Failed to fetch models', err);
      } finally {
        setIsLoadingModels(false);
      }
    } else {
      setSelectedModel(availableModels[0]);
    }
  };

  const handleStartInteraction = () => {
    if (!selectedModel) return;
    setActiveSession({
      model: selectedModel,
      mode: selectedMode,
      created_at: new Date().toISOString(),
      is_mock: MOCK_CONFIG.enabled
    });
    setMessages([]);
    setIsNewChatModalOpen(false);
  };

  const handleRenameSession = async () => {
    if (!sessionToAction?.id || !newName.trim()) return;
    try {
      await api.renameSession(sessionToAction.id, newName);
      setSessions(sessions.map(s => s.id === sessionToAction.id ? { ...s, name: newName } : s));
      if (activeSession?.id === sessionToAction.id) {
        setActiveSession({ ...activeSession, name: newName });
      }
      setIsRenameModalOpen(false);
      setNewName('');
      setSessionToAction(null);
    } catch (err) {
      alert('Failed to rename session.');
    }
  };

  const handleDeleteSession = async () => {
    if (!sessionToAction?.id || confirmText.toUpperCase() !== 'YES') {
      alert('Please type YES to confirm deletion.');
      return;
    }
    try {
      await api.deleteSession(sessionToAction.id);
      setSessions(sessions.filter(s => s.id !== sessionToAction.id));
      if (activeSession?.id === sessionToAction.id) {
        setActiveSession(null);
        setMessages([]);
      }
      setIsDeleteModalOpen(false);
      setConfirmText('');
      setSessionToAction(null);
    } catch (err) {
      alert('Failed to delete session.');
    }
  };

  const handleModelChange = async (newModel: string) => {
    if (!activeSession) return;
    try {
      if (activeSession.id) {
        await api.updateSessionModel(activeSession.id, newModel);
        setSessions(sessions.map(s => s.id === activeSession.id ? { ...s, model: newModel } : s));
      }
      setActiveSession({ ...activeSession, model: newModel });
    } catch (err) {
      alert('Failed to update playground intelligence.');
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !activeSession || isSending) return;
    
    let currentSession = { ...activeSession };
    const userMsg = { 
      role: 'user', 
      content: inputText + (stagedFile ? ` [Attached: ${stagedFile.name}]` : '') 
    };
    setMessages(prev => [...prev, userMsg]);
    
    const promptToSend = inputText;
    const fileToSend = stagedFile;
    
    setInputText('');
    setStagedFile(null);
    setIsSending(true);

    try {
      if (!currentSession.id) {
        const newSession = await api.createSession(
          globalApiKey, 
          currentSession.model, 
          currentSession.mode, 
          promptToSend
        );
        currentSession = newSession;
        setActiveSession(newSession);
        setSessions(prev => [newSession, ...prev]);
      }

      // MULTIMODAL CALL
      const assistantMsg = await api.sendMessage(
        currentSession.id!, 
        promptToSend, 
        currentSession.mode, 
        fileToSend,
        currentSession.model
      );
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      alert('Vortex connection failed. Ensure proxy is reachable.');
    } finally {
      setIsSending(false);
    }
  };

  const handleFileStage = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length) {
      setStagedFile(e.target.files[0]);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
        ? 'audio/webm' 
        : 'audio/mp4';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => { 
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data); 
        }
      };

      mediaRecorder.onstop = async () => {
        if (audioChunksRef.current.length === 0) {
          setIsTranscribing(false);
          return;
        }
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        setIsTranscribing(true);
        try {
          const result = await api.transcribe(audioBlob);
          if (result && result.text) {
            setInputText(prev => (prev ? `${prev} ${result.text}` : result.text));
          }
        } catch (err) { 
          console.error('Transcription error:', err);
          alert('Transcription failed. Ensure backend is reachable.'); 
        } finally { 
          setIsTranscribing(false); 
        }
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
    } catch (err) { 
      console.error('Mic error:', err);
      alert('Mic access denied or not available.'); 
    }
  };

  const stopRecording = () => { if (mediaRecorderRef.current && isRecording) { mediaRecorderRef.current.stop(); setIsRecording(false); } };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isDirectMode = backendType.includes('direct');

  return (
    <div className="flex h-screen bg-[#0a0a0f] text-[#e2e2e2] font-sans selection:bg-[#00f2ff]/30">
      {/* Sidebar */}
      <aside className="w-72 bg-[#0d0d14] border-r border-[#1f1f2e] flex flex-col hidden lg:flex">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8 px-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00f2ff] to-[#7000ff] flex items-center justify-center shadow-lg"><Sparkles size={18} className="text-white" /></div>
            <h1 className="text-xl font-bold tracking-tight electric-text">VORTEX</h1>
          </div>
          <button onClick={() => protectedAction(handleOpenNewChat)} className="w-full flex items-center justify-center gap-2 bg-[#1a1a2e] hover:bg-[#252545] text-[#00f2ff] py-3 px-4 rounded-xl font-semibold border border-[#00f2ff]/20 transition-all hover:shadow-[0_0_15px_rgba(0,242,255,0.15)] group"><Plus size={20} className="group-hover:rotate-90 transition-transform" /> New Playground</button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2 custom-scrollbar">
          {!isDirectMode && <div className="text-[10px] font-bold text-[#4a4a6a] mb-4 px-3 uppercase tracking-[0.2em]">Live Connections</div>}
          {sessions.map(s => (
            <div key={s.id} className="relative group">
              <button onClick={() => setActiveSession(s)} className={`w-full text-left flex flex-col gap-1 px-4 py-3.5 rounded-xl text-sm transition-all border ${activeSession?.id === s.id ? 'bg-[#1a1a2e] border-[#00f2ff]/40 shadow-[0_0_10px_rgba(0,242,255,0.05)]' : 'border-transparent hover:bg-[#161625] text-[#8e8eaf]'}`}><div className="flex items-center justify-between w-full pr-6"><span className={`font-medium truncate ${activeSession?.id === s.id ? 'text-[#00f2ff]' : ''}`}>{s.name || s.model}</span>{s.mode === 'code' ? <Terminal size={14} className="opacity-50 flex-shrink-0"/> : <Building size={14} className="opacity-50 flex-shrink-0"/>}</div><div className="flex items-center gap-2"><span className="text-[10px] opacity-40 font-mono truncate">{s.id?.split('-')[0]} // {s.mode.toUpperCase()}</span>{s.is_mock && <span className="text-[8px] bg-[#00f2ff]/10 text-[#00f2ff] px-1 rounded">MOCK</span>}</div></button>
              <button onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === s.id ? null : s.id!); }} className={`absolute right-3 top-4 p-1 rounded-md transition-opacity ${activeSession?.id === s.id || activeMenu === s.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} hover:bg-[#1f1f2e] text-[#4a4a6a] hover:text-[#00f2ff]`}><MoreVertical size={16} /></button>
              {activeMenu === s.id && ( <div className="absolute right-3 top-12 w-32 bg-[#12121e] border border-[#1f1f2e] rounded-lg shadow-xl z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-100"><button onClick={() => { setSessionToAction(s); setNewName(s.name || s.model); setIsRenameModalOpen(true); setActiveMenu(null); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#8e8eaf] hover:bg-[#1a1a2e] hover:text-[#00f2ff] transition-colors"><Edit2 size={12} /> Rename</button><button onClick={() => { setSessionToAction(s); setIsDeleteModalOpen(true); setActiveMenu(null); setConfirmText(''); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#8e8eaf] hover:bg-[#1a1a2e] hover:text-red-500 transition-colors"><Trash2 size={12} /> Delete</button></div> )}
            </div>
          ))}
        </div>
        <div className="p-6 border-t border-[#1f1f2e] bg-[#0a0a0f]/50 backdrop-blur-md">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 text-xs text-[#4a4a6a]">
              <div className={`w-2 h-2 rounded-full ${isDirectMode ? 'bg-[#7000ff]' : 'bg-[#00f2ff]'} animate-pulse`}></div>
              <span>{isDirectMode ? 'DIRECT ACCESS' : 'PROXY SECURE'}</span>
            </div>
            <div className={`text-[9px] font-bold uppercase tracking-widest p-1 px-2 rounded-md border self-start ${backendType.includes('java') ? 'text-[#00f2ff] bg-[#00f2ff]/5 border-[#00f2ff]/10' : 'text-[#7000ff] bg-[#7000ff]/5 border-[#7000ff]/10'}`}>
              {backendType.replace('_', ' ').toUpperCase()} ENGINE
            </div>
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col relative bg-gradient-to-b from-[#0a0a0f] to-[#0d0d14]" onClick={() => setActiveMenu(null)}>
        <header className="h-16 border-b border-[#1f1f2e] bg-[#0a0a0f]/80 backdrop-blur-xl flex items-center justify-between px-8 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            {activeSession ? (
              <div className="flex flex-col">
                <span className={`text-sm font-bold tracking-wide uppercase ${isDirectMode ? 'text-[#7000ff]' : 'text-[#00f2ff]'}`}>{activeSession.name || `${activeSession.mode} PLAYGROUND`}</span>
                <select value={activeSession.model} onChange={(e) => handleModelChange(e.target.value)} className="text-[11px] text-[#4a4a6a] font-mono bg-transparent border-none outline-none cursor-pointer hover:text-[#00f2ff] transition-colors">
                  {availableModels.length > 0 ? availableModels.map(m => <option key={m} value={m} className="bg-[#12121e]">{m.toUpperCase()}</option>) : <option value={activeSession.model}>{activeSession.model.toUpperCase()}</option>}
                </select>
              </div>
            ) : ( <span className="text-[#4a4a6a] font-medium tracking-widest text-xs uppercase">Systems Idle</span> )}
          </div>
          <div className="flex items-center gap-6">
             <div className="h-8 w-[1px] bg-[#1f1f2e]"></div>
             <Settings onClick={() => setIsSettingsModalOpen(true)} size={18} className="text-[#4a4a6a] hover:text-[#00f2ff] cursor-pointer transition-colors" />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 lg:p-10 space-y-8 custom-scrollbar">
          {!activeSession && (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-2xl mx-auto">
              <div className="w-20 h-20 rounded-3xl bg-[#1a1a2e] border border-[#00f2ff]/20 flex items-center justify-center mb-8 electric-glow"><Sparkles size={40} className="text-[#00f2ff]" /></div>
              <h2 className="text-3xl font-bold text-white mb-4 tracking-tight">Vortex {isDirectMode ? 'Personal' : 'Enterprise'} Terminal</h2>
              <p className="text-[#8e8eaf] text-lg leading-relaxed mb-8">{isSetupComplete ? 'Initialize a new playground to begin computing.' : 'Please configure your API Key to establish a connection.'}</p>
              <button onClick={() => protectedAction(handleOpenNewChat)} className={`px-8 py-3 rounded-xl font-bold transition-all ${isDirectMode ? 'bg-[#7000ff] text-white hover:bg-[#5a00cc]' : 'bg-[#00f2ff] text-[#0a0a0f] hover:bg-[#00d8e6]'}`}>{isSetupComplete ? 'Launch Playground' : 'Configure Endpoint'}</button>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-6 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300 ${msg.role === 'user' ? 'justify-end' : ''}`}>
              {msg.role !== 'user' && ( <div className={`w-10 h-10 rounded-xl bg-[#1a1a2e] border flex items-center justify-center flex-shrink-0 shadow-lg ${isDirectMode ? 'border-[#7000ff]/30' : 'border-[#00f2ff]/30'}`}><Bot size={22} className={isDirectMode ? 'text-[#7000ff]' : 'text-[#00f2ff]'} /></div> )}
              <div className={`px-6 py-4 rounded-2xl max-w-[85%] text-[15px] leading-relaxed border ${msg.role === 'user' ? `bg-gradient-to-br ${isDirectMode ? 'from-[#7000ff] to-[#ff00c8]' : 'from-[#00f2ff] to-[#7000ff]'} text-white font-medium border-transparent rounded-tr-none shadow-xl` : 'bg-[#12121e] text-[#e2e2e2] border-[#1f1f2e] rounded-tl-none shadow-xl'}`}>
                {msg.role === 'user' ? ( <div className="whitespace-pre-wrap">{msg.content}</div> ) : (
                  <div className="prose prose-invert prose-sm max-w-none prose-p:text-[#e2e2e2] prose-code:text-[#ff00c8]">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code({node, inline, className, children, ...props}: any) { const match = /language-(\w+)/.exec(className || ''); const codeString = String(children).replace(/\n$/, ''); const id = Math.random().toString(36).substr(2, 9); return !inline && match ? ( <div className="relative group/code my-4"><div className="absolute right-2 top-2 z-10 opacity-0 group-hover/code:opacity-100 transition-opacity"><button onClick={() => copyToClipboard(codeString, id)} className="p-1.5 bg-[#1a1a2e] border border-[#1f1f2e] rounded-md text-[#4a4a6a] hover:text-[#00f2ff] transition-colors">{copiedId === id ? <Check size={14} /> : <Copy size={14} />}</button></div><SyntaxHighlighter children={codeString} style={vscDarkPlus} language={match[1]} PreTag="div" className="rounded-xl border border-[#1f1f2e] !bg-[#0a0a0f] !p-5" {...props} /></div> ) : ( <code className={className} {...props}>{children}</code> ) } }} >{msg.content}</ReactMarkdown>
                  </div>
                )}
              </div>
              {msg.role === 'user' && ( <div className="w-10 h-10 rounded-xl bg-[#1a1a2e] border border-[#7000ff]/30 flex items-center justify-center flex-shrink-0 shadow-lg"><User size={22} className="text-[#7000ff]" /></div> )}
            </div>
          ))}
          {(isSending || isTranscribing) && ( <div className="flex gap-6 max-w-5xl mx-auto"><div className={`w-10 h-10 rounded-xl bg-[#1a1a2e] border flex items-center justify-center flex-shrink-0 ${isDirectMode ? 'border-[#7000ff]/30' : 'border-[#00f2ff]/30'}`}><Bot size={22} className={isDirectMode ? 'text-[#7000ff]' : 'text-[#00f2ff]'} /></div><div className="px-6 py-4 rounded-2xl bg-[#12121e] text-[#4a4a6a] border border-[#1f1f2e] flex items-center gap-3"><div className="flex gap-1"><div className={`w-1.5 h-1.5 rounded-full animate-bounce ${isDirectMode ? 'bg-[#7000ff]' : 'bg-[#00f2ff]'}`}></div><div className={`w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:0.2s] ${isDirectMode ? 'bg-[#7000ff]' : 'bg-[#00f2ff]'}`}></div><div className={`w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:0.4s] ${isDirectMode ? 'bg-[#7000ff]' : 'bg-[#00f2ff]'}`}></div></div><span className="text-xs font-mono uppercase tracking-widest opacity-40">Computing</span></div></div> )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        {activeSession && (
          <div className="p-8 bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f] to-transparent">
            <div className="max-w-4xl mx-auto">
              {stagedFile && (
                <div className={`mb-3 flex items-center gap-3 bg-[#12121e] p-2 pr-4 rounded-xl border animate-in slide-in-from-bottom-2 duration-200 ${isDirectMode ? 'border-[#7000ff]/30' : 'border-[#00f2ff]/30'}`}>
                  <div className="w-10 h-10 rounded-lg bg-[#1a1a2e] flex items-center justify-center text-[#00f2ff]">
                    {stagedFile.type.startsWith('image/') ? <ImageIcon size={20} className={isDirectMode ? 'text-[#7000ff]' : 'text-[#00f2ff]'} /> : <FileText size={20} className={isDirectMode ? 'text-[#7000ff]' : 'text-[#00f2ff]'} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate text-white">{stagedFile.name}</p>
                    <p className="text-[10px] text-[#4a4a6a] uppercase tracking-widest">Payload Staged</p>
                  </div>
                  <button onClick={() => setStagedFile(null)} className="p-1 hover:text-red-500 transition-colors"><X size={16} /></button>
                </div>
              )}
              <div className="relative flex items-end gap-3 bg-[#12121e] p-3 rounded-2xl border border-[#1f1f2e] focus-within:border-[#00f2ff]/50 transition-all">
                <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileStage} accept=".txt,.pdf,.py,.java,.js,.ts,.md,.png,.jpg,.jpeg" />
                <div className="flex items-center gap-1">
                  <button onClick={() => fileInputRef.current?.click()} disabled={isSending || isRecording} className="p-3 text-[#4a4a6a] hover:text-[#00f2ff] rounded-xl hover:bg-[#1a1a2e] transition-all"><Paperclip size={20} /></button>
                  <button onClick={isRecording ? stopRecording : startRecording} disabled={isSending || isTranscribing} className={`p-3 rounded-xl transition-all ${isRecording ? 'text-red-500 bg-red-500/10 animate-pulse' : 'text-[#4a4a6a] hover:text-[#00f2ff] hover:bg-[#1a1a2e]'}`}>{isRecording ? <MicOff size={20} /> : <Mic size={20} />}</button>
                </div>
                <textarea value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} placeholder={isRecording ? "Listening..." : `Command VORTEX...`} className="flex-1 bg-transparent border-0 focus:ring-0 resize-none py-3 px-2 text-sm text-[#e2e2e2] placeholder-[#4a4a6a] scrollbar-hide" rows={1} disabled={isSending || isRecording} />
                
                <button 
                  onClick={handleSendMessage} 
                  disabled={!inputText.trim() || isSending || isRecording} 
                  className={`p-3 rounded-xl transition-all shadow-lg active:scale-95 ${(!inputText.trim() || isSending || isRecording) ? 'bg-[#1a1a2e] text-[#4a4a6a] cursor-not-allowed opacity-50' : `bg-gradient-to-br ${isDirectMode ? 'from-[#7000ff] to-[#ff00c8] text-white' : 'from-[#00f2ff] to-[#7000ff] text-[#0a0a0f]'}`}`}
                >
                  <Send size={20} />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Authorization Modal */}
      {isInitialSetupOpen && (
        <div className="fixed inset-0 bg-[#0a0a0f]/95 backdrop-blur-xl flex items-center justify-center z-[100] p-4">
          <div className="bg-[#12121e] rounded-3xl w-full max-w-md p-10 border border-[#1f1f2e] text-center shadow-[0_0_50px_rgba(0,242,255,0.1)]">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#00f2ff] to-[#7000ff] flex items-center justify-center mx-auto mb-8 shadow-lg"><Key size={30} className="text-white" /></div>
            <h2 className="text-2xl font-bold text-white mb-2">Vortex Access Control</h2>
            <p className="text-[#4a4a6a] text-sm mb-8">Select your computation engine and authorize the link.</p>
            
            <div className="mb-8 p-4 bg-[#0a0a0f] border border-[#1f1f2e] rounded-2xl">
              <label className="block text-[10px] font-bold text-[#4a4a6a] mb-3 uppercase tracking-widest text-left">Computation Core</label>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <button onClick={() => setBackendTypeState('java_proxy')} className={`py-2 px-2 rounded-lg text-[9px] font-bold uppercase border transition-all ${backendType === 'java_proxy' ? 'bg-[#00f2ff]/10 border-[#00f2ff] text-[#00f2ff]' : 'border-[#1f1f2e] text-[#4a4a6a]'}`}>Java (Proxy)</button>
                <button onClick={() => setBackendTypeState('python_proxy')} className={`py-2 px-2 rounded-lg text-[9px] font-bold uppercase border transition-all ${backendType === 'python_proxy' ? 'bg-[#00f2ff]/10 border-[#00f2ff] text-[#00f2ff]' : 'border-[#1f1f2e] text-[#4a4a6a]'}`}>Python (Proxy)</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setBackendTypeState('java_direct')} className={`py-2 px-2 rounded-lg text-[9px] font-bold uppercase border transition-all ${backendType === 'java_direct' ? 'bg-[#7000ff]/10 border-[#7000ff] text-[#7000ff]' : 'border-[#1f1f2e] text-[#4a4a6a]'}`}>Java (Direct)</button>
                <button onClick={() => setBackendTypeState('python_direct')} className={`py-2 px-2 rounded-lg text-[9px] font-bold uppercase border transition-all ${backendType === 'python_direct' ? 'bg-[#7000ff]/10 border-[#7000ff] text-[#7000ff]' : 'border-[#1f1f2e] text-[#4a4a6a]'}`}>Python (Direct)</button>
              </div>
            </div>

            <input type="password" value={newApiKey} onChange={e => setNewApiKey(e.target.value)} className="w-full px-5 py-4 bg-[#0a0a0f] border border-[#1f1f2e] rounded-2xl focus:border-[#00f2ff] outline-none transition-all placeholder-[#4a4a6a] text-sm mb-8" placeholder={MOCK_CONFIG.enabled ? "MOCK MODE ACTIVE (ENTER ANYTHING)" : "Enter API Key (sk-... or AI...)"} />
            <button onClick={handleInitialSetup} disabled={isUpdatingKey || (!MOCK_CONFIG.enabled && !newApiKey.startsWith('sk-') && !newApiKey.startsWith('AI'))} className={`w-full py-4 rounded-2xl font-bold transition-all shadow-xl flex items-center justify-center gap-2 tracking-widest uppercase text-xs ${isDirectMode ? 'bg-[#7000ff] text-white' : 'bg-[#00f2ff] text-[#0a0a0f]'}`}>{isUpdatingKey ? <Loader2 className="animate-spin" /> : 'Establish Link'}</button>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 bg-[#0a0a0f]/90 backdrop-blur-md flex items-center justify-center z-[110] p-4">
          <div className="bg-[#12121e] rounded-3xl w-full max-w-md p-8 border border-[#1f1f2e] shadow-2xl relative">
            <button onClick={() => { setIsSettingsModalOpen(false); setConfirmText(''); }} className="absolute top-6 right-6 text-[#4a4a6a] hover:text-white"><X /></button>
            <h3 className="text-xl font-bold text-white mb-8 flex items-center gap-3"><Settings className="text-[#00f2ff]" /> Global Settings</h3>
            <div className="space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar pr-2">
              <section className="p-6 bg-[#0a0a0f]/50 border border-[#1f1f2e] rounded-2xl">
                <div className="text-[10px] font-bold text-[#00f2ff] uppercase tracking-widest mb-4">Core Engine</div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <button onClick={() => setBackendTypeState('java_proxy')} className={`py-2 px-2 rounded-lg text-[9px] font-bold uppercase border transition-all ${backendType === 'java_proxy' ? 'bg-[#00f2ff]/10 border-[#00f2ff] text-[#00f2ff]' : 'border-[#1f1f2e] text-[#4a4a6a]'}`}>Java (Proxy)</button>
                  <button onClick={() => setBackendTypeState('python_proxy')} className={`py-2 px-2 rounded-lg text-[9px] font-bold uppercase border transition-all ${backendType === 'python_proxy' ? 'bg-[#00f2ff]/10 border-[#00f2ff] text-[#00f2ff]' : 'border-[#1f1f2e] text-[#4a4a6a]'}`}>Python (Proxy)</button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setBackendTypeState('java_direct')} className={`py-2 px-2 rounded-lg text-[9px] font-bold uppercase border transition-all ${backendType === 'java_direct' ? 'bg-[#7000ff]/10 border-[#7000ff] text-[#7000ff]' : 'border-[#1f1f2e] text-[#4a4a6a]'}`}>Java (Direct)</button>
                  <button onClick={() => setBackendTypeState('python_direct')} className={`py-2 px-2 rounded-lg text-[9px] font-bold uppercase border transition-all ${backendType === 'python_direct' ? 'bg-[#7000ff]/10 border-[#7000ff] text-[#7000ff]' : 'border-[#1f1f2e] text-[#4a4a6a]'}`}>Python (Direct)</button>
                </div>
              </section>
              {!isDirectMode && (
                <section className="p-6 bg-[#0a0a0f]/50 border border-[#1f1f2e] rounded-2xl">
                  <div className="text-[10px] font-bold text-[#00f2ff] uppercase tracking-widest mb-4">Knowledge Base</div>
                  <Link to="/admin/upload-documents" onClick={() => setIsSettingsModalOpen(false)} className="px-4 py-2 bg-[#1a1a2e] text-[#00f2ff] rounded-lg text-[10px] font-bold border border-[#00f2ff]/20 uppercase tracking-widest flex items-center gap-2 hover:bg-[#252545] transition-all"><Database size={12} /> Admin Uplink</Link>
                </section>
              )}
              <section className="p-6 bg-[#0a0a0f]/50 border border-[#1f1f2e] rounded-2xl">
                <div className="text-[10px] font-bold text-[#00f2ff] uppercase tracking-widest mb-4">API Configuration</div>
                <input type="password" value={newApiKey} onChange={e => setNewApiKey(e.target.value)} className="w-full px-4 py-3 bg-[#0d0d14] border border-[#1f1f2e] rounded-xl text-sm mb-6 outline-none focus:border-[#00f2ff]" placeholder="••••••••••••••••" />
                <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl mb-6 flex items-start gap-4"><AlertTriangle className="text-red-500 flex-shrink-0" size={20} /><div><div className="text-xs font-bold text-red-500 uppercase mb-1">Configuration Lock</div><div className="text-[11px] text-[#8e8eaf]">Type <span className="text-red-500 font-bold">YES</span> to synchronize engine settings.</div></div></div>
                <input type="text" value={confirmText} onChange={e => setConfirmText(e.target.value)} className="w-full px-4 py-3 bg-[#0d0d14] border border-[#1f1f2e] rounded-xl text-sm mb-6 outline-none focus:border-red-500 placeholder-red-900/30" placeholder="Type YES" />
                <div className="flex gap-3"><button onClick={handleUpdateSettings} className="flex-1 py-3 bg-[#1a1a2e] hover:bg-[#252545] text-[#00f2ff] rounded-xl text-xs font-bold border border-[#00f2ff]/20 transition-all">Update Core</button><button onClick={handleDeleteApiKey} className="flex-1 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl text-xs font-bold border border-red-500/20 transition-all">Clear All</button></div>
              </section>
            </div>
          </div>
        </div>
      )}

      {isNewChatModalOpen && (
        <div className="fixed inset-0 bg-[#0a0a0f]/80 backdrop-blur-md flex items-center justify-center z-[110] p-4">
          <div className="bg-[#12121e] rounded-3xl shadow-2xl w-full max-w-md p-8 border border-[#1f1f2e] animate-in zoom-in-95 duration-300 relative overflow-hidden">
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-[#00f2ff]/10 rounded-full blur-[80px]"></div>
            <div className="flex justify-between items-center mb-8 relative"><h3 className="text-2xl font-bold text-white tracking-tight tracking-widest uppercase text-sm">Initialize Playground</h3><button onClick={() => setIsNewChatModalOpen(false)} className="text-[#4a4a6a] hover:text-white"><X /></button></div>
            <div className="space-y-6 relative">
              {availableModels.length > 0 ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
                  <div><label className="block text-[10px] font-bold text-[#4a4a6a] mb-2 uppercase tracking-widest">Model Selection</label><select value={selectedModel} onChange={e => setSelectedModel(e.target.value)} className="w-full px-4 py-3 bg-[#0a0a0f] border border-[#1f1f2e] rounded-xl outline-none text-sm text-[#e2e2e2] cursor-pointer appearance-none">{availableModels.map(m => (<option key={m} value={m}>{m.toUpperCase()}</option>))}</select></div>
                  {!isDirectMode && (
                    <div><label className="block text-[10px] font-bold text-[#4a4a6a] mb-2 uppercase tracking-widest">Operation Mode</label><div className="grid grid-cols-2 gap-4"><button onClick={() => setSelectedMode('code')} className={`flex flex-col items-center gap-3 p-4 border rounded-2xl transition-all ${selectedMode === 'code' ? 'border-[#00f2ff] bg-[#00f2ff]/5 text-[#00f2ff]' : 'border-[#1f1f2e] text-[#4a4a6a]'}`}><Code size={24} /><span className="text-[11px] font-bold uppercase tracking-widest">Code</span></button><button onClick={() => setSelectedMode('org')} className={`flex flex-col items-center gap-3 p-4 border rounded-2xl transition-all ${selectedMode === 'org' ? 'border-[#7000ff] bg-[#7000ff]/5 text-[#7000ff]' : 'border-[#1f1f2e] text-[#4a4a6a]'}`}><Building size={24} /><span className="text-[11px] font-bold uppercase tracking-widest">Org</span></button></div></div>
                  )}
                  <button onClick={handleStartInteraction} className={`w-full py-4 font-bold rounded-xl shadow-xl active:scale-95 tracking-widest uppercase ${isDirectMode ? 'bg-[#7000ff] text-white' : 'bg-gradient-to-r from-[#00f2ff] to-[#7000ff] text-[#0a0a0f]'}`}>Start Chat</button>
                </div>
              ) : ( <div className="flex flex-col items-center py-10"><Loader2 className="animate-spin text-[#00f2ff] mb-4" size={32} /><span className="text-[10px] text-[#4a4a6a] tracking-widest uppercase">Fetching Cores</span></div> )}
            </div>
          </div>
        </div>
      )}

      {isRenameModalOpen && (
        <div className="fixed inset-0 bg-[#0a0a0f]/80 backdrop-blur-md flex items-center justify-center z-[120] p-4">
          <div className="bg-[#12121e] rounded-3xl w-full max-w-sm p-8 border border-[#1f1f2e] shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-6">Rename Session</h3>
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)} className="w-full px-4 py-3 bg-[#0a0a0f] border border-[#1f1f2e] rounded-xl outline-none focus:border-[#00f2ff] text-sm mb-8" placeholder="Enter new name" />
            <div className="flex gap-3"><button onClick={() => setIsRenameModalOpen(false)} className="flex-1 py-3 bg-[#1a1a2e] text-[#8e8eaf] rounded-xl text-xs font-bold border border-[#1f1f2e] transition-all">Cancel</button><button onClick={handleRenameSession} className="flex-1 py-3 bg-[#00f2ff] text-[#0a0a0f] rounded-xl text-xs font-bold transition-all">Confirm</button></div>
          </div>
        </div>
      )}

      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-[#0a0a0f]/80 backdrop-blur-md flex items-center justify-center z-[120] p-4">
          <div className="bg-[#12121e] rounded-3xl w-full max-w-sm p-8 border border-[#1f1f2e] shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4">Delete Session?</h3>
            <p className="text-xs text-[#8e8eaf] mb-6">This action is irreversible. Type <span className="text-red-500 font-bold">YES</span> to confirm deletion.</p>
            <input type="text" value={confirmText} onChange={e => setConfirmText(e.target.value)} className="w-full px-4 py-3 bg-[#0a0a0f] border border-[#1f1f2e] rounded-xl outline-none focus:border-red-500 text-sm mb-8 placeholder-red-900/20" placeholder="YES" />
            <div className="flex gap-3"><button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-3 bg-[#1a1a2e] text-[#8e8eaf] rounded-xl text-xs font-bold border border-[#1f1f2e] transition-all">Cancel</button><button onClick={handleDeleteSession} className="flex-1 py-3 bg-red-500 text-white rounded-xl text-xs font-bold transition-all shadow-[0_0_15px_rgba(239,68,68,0.2)]">Delete</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<ChatPlatform />} />
      <Route path="/admin/upload-documents" element={<AdminUpload />} />
    </Routes>
  );
}

export default App;