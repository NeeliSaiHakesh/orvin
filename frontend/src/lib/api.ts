/**
 * AutoMLOps API Client
 * 
 * Centralized API client for communicating with the FastAPI backend.
 * Handles authentication, error handling, CORS fallbacks, and all API endpoints.
 */

function normalizeBaseURL(url: string): string {
  let u = url.trim().replace(/\/+$/, '');
  if (!u.endsWith('/api/v1') && !u.endsWith('/api')) {
    u = `${u}/api/v1`;
  }
  return u;
}

function getCandidateBaseURLs(): string[] {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return [normalizeBaseURL(process.env.NEXT_PUBLIC_API_URL)];
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname || 'localhost';
    const urls: string[] = ['http://127.0.0.1:8000/api/v1', 'http://localhost:8000/api/v1'];
    if (host !== '127.0.0.1' && host !== 'localhost') {
      urls.unshift(`http://${host}:8000/api/v1`);
    }
    return urls;
  }
  return ['http://127.0.0.1:8000/api/v1', 'http://localhost:8000/api/v1'];
}

/**
 * Core fetch wrapper with auth token, CORS error handling, resilience, and retry.
 */
async function fetchAPI(endpoint: string, options: RequestInit = {}): Promise<any> {
  let token: string | null = null;
  if (typeof window !== 'undefined') {
    token = localStorage.getItem('token');
  }

  const headers: Record<string, string> = {};

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (options.headers) {
    Object.assign(headers, options.headers);
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const baseURLs = getCandidateBaseURLs();
  let lastError: any = null;

  for (const baseURL of baseURLs) {
    try {
      const response = await fetch(`${baseURL}${endpoint}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
        throw new Error(error.detail || error.message || `API Error: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return response.json();
      }
      return response;
    } catch (err: any) {
      lastError = err;
      if (err.name === 'AbortError' || (err.message && (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')))) {
        continue;
      }
      throw err;
    }
  }

  throw new Error(lastError?.message || `Unable to connect to AutoMLOps backend server at ${baseURLs[0]}. Please ensure backend is running.`);
}

/**
 * Download helper for file responses (ZIP archives, models, etc.)
 */
async function downloadFile(endpoint: string, filename: string): Promise<void> {
  let token: string | null = null;
  if (typeof window !== 'undefined') {
    token = localStorage.getItem('token');
  }

  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const baseURL = getCandidateBaseURLs()[0];
  const response = await fetch(`${baseURL}${endpoint}`, { headers });
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);
  
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

// ─────────────────────────────────────────────────
// API Namespace
// ─────────────────────────────────────────────────
export const api = {
  // ── Authentication ──
  auth: {
    register: (data: { email: string; username: string; password: string }) =>
      fetchAPI('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

    login: (data: { email: string; password: string }) =>
      fetchAPI('/auth/login', { method: 'POST', body: JSON.stringify(data) }),

    getMe: () =>
      fetchAPI('/auth/me'),
  },

  // ── Projects ──
  projects: {
    list: () =>
      fetchAPI('/projects'),

    create: (data: { name: string; description?: string; task_type?: string; target_column?: string }) =>
      fetchAPI('/projects', { method: 'POST', body: JSON.stringify(data) }),

    get: (id: string) =>
      fetchAPI(`/projects/${id}`),

    update: (id: string, data: Record<string, any>) =>
      fetchAPI(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

    delete: (id: string) =>
      fetchAPI(`/projects/${id}`, { method: 'DELETE' }),
  },

  // ── Datasets ──
  datasets: {
    upload: (projectId: string, file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return fetchAPI(`/projects/${projectId}/datasets`, {
        method: 'POST',
        body: formData,
      });
    },

    list: (projectId: string) =>
      fetchAPI(`/projects/${projectId}/datasets`),

    get: (datasetId: string) =>
      fetchAPI(`/datasets/${datasetId}`),

    preview: (datasetId: string) =>
      fetchAPI(`/datasets/${datasetId}/preview`),

    delete: (datasetId: string) =>
      fetchAPI(`/datasets/${datasetId}`, { method: 'DELETE' }),
  },

  // ── Analysis ──
  analysis: {
    analyze: (datasetId: string) =>
      fetchAPI(`/datasets/${datasetId}/analyze`, { method: 'POST' }),

    getReport: (datasetId: string) =>
      fetchAPI(`/datasets/${datasetId}/analysis`),
  },

  // ── Cleaning ──
  cleaning: {
    suggest: (datasetId: string) =>
      fetchAPI(`/datasets/${datasetId}/clean/suggest`, { method: 'POST' }),

    apply: (datasetId: string, config: Record<string, boolean>) =>
      fetchAPI(`/datasets/${datasetId}/clean/apply`, {
        method: 'POST',
        body: JSON.stringify(config),
      }),

    history: (datasetId: string) =>
      fetchAPI(`/datasets/${datasetId}/clean/history`),
  },

  // ── Feature Engineering ──
  features: {
    engineer: (datasetId: string) =>
      fetchAPI(`/datasets/${datasetId}/features/engineer`, { method: 'POST' }),

    get: (datasetId: string) =>
      fetchAPI(`/datasets/${datasetId}/features`),

    importance: (datasetId: string) =>
      fetchAPI(`/datasets/${datasetId}/features/importance`),
  },

  // ── Training ──
  training: {
    start: (projectId: string, config?: Record<string, any>) =>
      fetchAPI(`/projects/${projectId}/train`, {
        method: 'POST',
        body: JSON.stringify(config || {}),
      }),

    leaderboard: (projectId: string) =>
      fetchAPI(`/projects/${projectId}/leaderboard`),

    getModel: (modelId: string) =>
      fetchAPI(`/models/${modelId}`),

    selectModel: (modelId: string) =>
      fetchAPI(`/models/${modelId}/select`, { method: 'POST' }),
  },

  // ── Explainability ──
  explain: {
    getReport: (modelId: string) =>
      fetchAPI(`/models/${modelId}/explain`),

    getShap: (modelId: string) =>
      fetchAPI(`/models/${modelId}/shap`),
  },

  // ── API Generation ──
  apiGen: {
    generate: (modelId: string) =>
      fetchAPI(`/models/${modelId}/generate-api`, { method: 'POST' }),

    getCode: (modelId: string) =>
      fetchAPI(`/models/${modelId}/api-code`),

    download: (modelId: string, modelName: string) =>
      downloadFile(`/models/${modelId}/download-api`, `${modelName}_api.zip`),
  },

  // ── AI Assistant ──
  assistant: {
    ask: (projectId: string, question: string) =>
      fetchAPI(`/projects/${projectId}/assistant/ask`, {
        method: 'POST',
        body: JSON.stringify({ question }),
      }),

    suggestions: (projectId: string) =>
      fetchAPI(`/projects/${projectId}/assistant/suggestions`),
  },

  // ── AI Decision Engine ──
  decision: {
    get: (projectId: string, datasetId?: string) => {
      const q = datasetId ? `?dataset_id=${encodeURIComponent(datasetId)}` : '';
      return fetchAPI(`/projects/${projectId}/decisions${q}`);
    },

    generate: (projectId: string, datasetId?: string) => {
      const q = datasetId ? `?dataset_id=${encodeURIComponent(datasetId)}` : '';
      return fetchAPI(`/projects/${projectId}/decisions/generate${q}`, { method: 'POST' });
    },
  },

  // ── What-If Model Simulator ──
  simulator: {
    getSchema: (projectId: string, datasetId?: string) => {
      const q = datasetId ? `?dataset_id=${encodeURIComponent(datasetId)}` : '';
      return fetchAPI(`/projects/${projectId}/simulator/schema${q}`);
    },

    run: (projectId: string, payload: Record<string, any>) =>
      fetchAPI(`/projects/${projectId}/simulator/run`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },

  // ── Self-Healing Pipeline ──
  selfHealing: {
    getStatus: (projectId: string) =>
      fetchAPI(`/projects/${projectId}/self-healing/status`),

    trigger: (projectId: string, failureType: string) =>
      fetchAPI(`/projects/${projectId}/self-healing/trigger`, {
        method: 'POST',
        body: JSON.stringify({ failure_type: failureType, simulation_mode: true }),
      }),

    resetCircuitBreaker: (projectId: string) =>
      fetchAPI(`/projects/${projectId}/self-healing/circuit-breaker/reset`, {
        method: 'POST',
      }),
  },

  // ── Cost & Carbon Optimizer ──
  costCarbon: {
    getEstimate: (projectId: string, datasetId?: string) => {
      const q = datasetId ? `?dataset_id=${encodeURIComponent(datasetId)}` : '';
      return fetchAPI(`/projects/${projectId}/cost-carbon/estimate${q}`);
    },

    calculate: (projectId: string, payload: Record<string, any>) =>
      fetchAPI(`/projects/${projectId}/cost-carbon/calculate`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },

  // ── Model Health & Production Readiness Score ──
  readiness: {
    getScore: (projectId: string, datasetId?: string) => {
      const q = datasetId ? `?dataset_id=${encodeURIComponent(datasetId)}` : '';
      return fetchAPI(`/projects/${projectId}/readiness/score${q}`);
    },
  },
};