import axios from 'axios';

// Unified Python Proxy Backend
const BASE_URL = 'http://localhost:8002/api/v1';

// Centralized Frontend Mock Configuration
export const MOCK_CONFIG = {
  enabled: false, 
  delay: 800,
  models: ["gpt-4o", "gemini-2.0-flash", "llama-3-70b"],
  responses: {
    general: [
      "I have analyzed your request using the VORTEX Orchestrator."
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
    const res = await axios.post(`${BASE_URL}/models`, { api_key: apiKey });
    return res.data.models;
  },
  
  createSession: async (apiKey: string, model: string, initialMessage: string) => {
    if (MOCK_CONFIG.enabled) {
      await sleep(MOCK_CONFIG.delay);
      return {
        id: `mock-${Math.random().toString(36).substr(2, 9)}`,
        name: generateMockName(initialMessage),
        model,
        is_mock: true,
        created_at: new Date().toISOString()
      };
    }
    const res = await axios.post(`${BASE_URL}/sessions`, { 
      api_key: apiKey, 
      model, 
      initial_message: initialMessage
    });
    return res.data;
  },
  
  getSessions: async (apiKey: string) => {
    if (MOCK_CONFIG.enabled) return [];
    try {
      const res = await axios.post(`${BASE_URL}/sessions/filter`, { api_key: apiKey });
      return res.data;
    } catch (err) {
      return [];
    }
  },
  
  getMessages: async (sessionId: string) => {
    if (!sessionId || sessionId.startsWith('mock-')) return [];
    const res = await axios.get(`${BASE_URL}/sessions/${sessionId}/messages`);
    return res.data;
  },
  
  sendMessage: async (sessionId: string, content: string, file: File | null = null, model: string = "") => {
    if (sessionId.startsWith('mock-')) {
      await sleep(MOCK_CONFIG.delay + 500);
      return { role: 'assistant', content: `(SIMULATED) ${MOCK_CONFIG.responses.general[0]}` };
    }

    const formData = new FormData();
    formData.append('session_id', sessionId);
    formData.append('content', content);
    formData.append('model', model);
    formData.append('api_key', localStorage.getItem('VORTEX_API_KEY') || '');
    if (file) formData.append('file', file);

    const res = await axios.post(`${BASE_URL}/chat`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  },

  adminIngestKnowledge: async (file: File, apiKey: string, chunkSize: number, chunkOverlap: number) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', apiKey);
    formData.append('chunk_size', chunkSize.toString());
    formData.append('chunk_overlap', chunkOverlap.toString());
    const res = await axios.post(`${BASE_URL}/admin/ingest`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  },

  transcribe: async (audioBlob: Blob) => {
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');
    const res = await axios.post(`${BASE_URL}/transcribe`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  },

  renameSession: async (sessionId: string, newName: string) => {
    const res = await axios.patch(`${BASE_URL}/sessions/${sessionId}`, { name: newName });
    return res.data;
  },

  deleteSession: async (sessionId: string) => {
    const res = await axios.delete(`${BASE_URL}/sessions/${sessionId}`);
    return res.data;
  },

  updateSessionModel: async (sessionId: string, newModel: string) => {
    const res = await axios.patch(`${BASE_URL}/sessions/${sessionId}`, { model: newModel });
    return res.data;
  }
};