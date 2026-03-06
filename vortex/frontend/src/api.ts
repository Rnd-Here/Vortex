import axios from 'axios';

// Backend Mapping
const BACKENDS = {
  java_proxy: 'http://localhost:8000/api/v1',
  python_proxy: 'http://localhost:8002/api/v1',
  java_direct: 'http://localhost:8003/api/v1',
  python_direct: 'http://localhost:8004/api/v1'
};

export type BackendType = keyof typeof BACKENDS;

let currentBaseUrl = BACKENDS[localStorage.getItem('VORTEX_BACKEND_TYPE') as BackendType || 'java_proxy'];

export const setBackendType = (type: BackendType) => {
  currentBaseUrl = BACKENDS[type];
  localStorage.setItem('VORTEX_BACKEND_TYPE', type);
};

export const getBackendType = (): BackendType => {
  return (localStorage.getItem('VORTEX_BACKEND_TYPE') as BackendType) || 'java_proxy';
};

// Centralized Frontend Mock Configuration
export const MOCK_CONFIG = {
  enabled: true, 
  delay: 800,
  models: ["llama-3-70b-sim", "gpt-4-turbo-sim", "gemini-1.5-pro-sim", "mistral-large-sim"],
  responses: {
    code: [
      "Here is a simulated code solution:\n\n```python\nprint('Hello from the simulated environment!')\n```",
      "I recommend checking the internal documentation for the exact API specifications."
    ],
    org: [
      "The next organizational update is scheduled for next Monday.",
      "Internal hackathon registrations are now open in the 'Innova' portal."
    ]
  }
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const generateMockName = (msg: string) => {
  const words = msg.split(' ').slice(0, 3).join(' ');
  return words.length > 20 ? words.substring(0, 20) + '...' : words || "New Session";
};

export const api = {
  fetchModels: async (apiKey: string) => {
    if (MOCK_CONFIG.enabled) {
      await sleep(MOCK_CONFIG.delay);
      return MOCK_CONFIG.models;
    }
    const res = await axios.post(`${currentBaseUrl}/models`, { api_key: apiKey, is_mock: false });
    return res.data.models;
  },
  
  createSession: async (apiKey: string, model: string, mode: string, initialMessage: string) => {
    if (MOCK_CONFIG.enabled) {
      await sleep(MOCK_CONFIG.delay);
      return {
        id: `mock-${Math.random().toString(36).substr(2, 9)}`,
        name: generateMockName(initialMessage),
        model,
        mode,
        is_mock: true,
        created_at: new Date().toISOString()
      };
    }
    const res = await axios.post(`${currentBaseUrl}/sessions`, { 
      api_key: apiKey, 
      model, 
      mode,
      initial_message: initialMessage,
      is_mock: false 
    });
    return res.data;
  },
  
  getSessions: async (apiKey: string) => {
    if (MOCK_CONFIG.enabled || currentBaseUrl.includes('8003') || currentBaseUrl.includes('8004')) {
      return []; // Direct backends are stateless in this POC
    }
    try {
      const res = await axios.post(`${currentBaseUrl}/sessions/filter`, { api_key: apiKey });
      return res.data;
    } catch (err) {
      return [];
    }
  },
  
  getMessages: async (sessionId: string) => {
    if (!sessionId || sessionId.startsWith('mock-') || sessionId.startsWith('pers-')) {
      return [];
    }
    try {
      const res = await axios.get(`${currentBaseUrl}/sessions/${sessionId}/messages`);
      return res.data;
    } catch (err) {
      return [];
    }
  },
  
  sendMessage: async (sessionId: string, content: string, mode: string = "code", file: File | null = null, model: string = "") => {
    if (sessionId.startsWith('mock-')) {
      await sleep(MOCK_CONFIG.delay + 500);
      const responses = mode === 'code' ? MOCK_CONFIG.responses.code : MOCK_CONFIG.responses.org;
      const response = responses[Math.floor(Math.random() * responses.length)];
      return {
        role: 'assistant',
        content: `(SIMULATED) ${response} ${file ? "[Processed Attachment: " + file.name + "]" : ""}`
      };
    }

    const formData = new FormData();
    formData.append('session_id', sessionId);
    formData.append('content', content);
    formData.append('model', model);
    formData.append('model_name', model); // For Python compatibility
    formData.append('api_key', localStorage.getItem('VORTEX_API_KEY') || '');
    if (file) formData.append('file', file);

    const res = await axios.post(`${currentBaseUrl}/chat`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  },

  ingestKnowledge: async (file: File, apiKey: string) => {
    if (MOCK_CONFIG.enabled) {
      await sleep(2000);
      return { status: "success", message: "Simulated ingestion complete." };
    }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', apiKey);
    const res = await axios.post(`${currentBaseUrl}/ingest`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    return res.data;
  },

  adminIngestKnowledge: async (file: File, apiKey: string, chunkSize: number, chunkOverlap: number, temperature: number) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', apiKey);
    formData.append('chunk_size', chunkSize.toString());
    formData.append('chunk_overlap', chunkOverlap.toString());
    const res = await axios.post(`${currentBaseUrl}/admin/ingest`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    return res.data;
  },

  transcribe: async (audioBlob: Blob) => {
    if (MOCK_CONFIG.enabled) {
      await sleep(1500);
      return { text: "Simulated transcription." };
    }
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');
    
    const res = await axios.post(`${currentBaseUrl}/transcribe`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  },

  renameSession: async (sessionId: string, newName: string) => {
    if (sessionId.startsWith('pers-')) return { success: true };
    const res = await axios.patch(`${currentBaseUrl}/sessions/${sessionId}`, { name: newName });
    return res.data;
  },

  deleteSession: async (sessionId: string) => {
    if (sessionId.startsWith('pers-')) return { success: true };
    const res = await axios.delete(`${currentBaseUrl}/sessions/${sessionId}`);
    return res.data;
  },

  updateSessionModel: async (sessionId: string, newModel: string) => {
    if (sessionId.startsWith('pers-')) return { success: true };
    const res = await axios.patch(`${currentBaseUrl}/sessions/${sessionId}`, { model: newModel });
    return res.data;
  }
};