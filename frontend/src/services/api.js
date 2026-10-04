import axios from 'axios';

const api = axios.create({
  baseURL: 'https://relay-workflow-automation.onrender.com/api',
  timeout: 15000,
});

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('relay_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 — token expired/invalid, force logout
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('relay_token');
      localStorage.removeItem('relay_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ─── Auth ────────────────────────────────────────────────────────
export const signup = (data) => api.post('/auth/signup', data);
export const login = (data) => api.post('/auth/login', data);
export const getMe = () => api.get('/auth/me');

// ─── Workflows ───────────────────────────────────────────────────
export const getWorkflows = () => api.get('/workflows');
export const getWorkflow = (id) => api.get(`/workflows/${id}`);
export const createWorkflow = (data) => api.post('/workflows', data);
export const updateWorkflow = (id, data) => api.put(`/workflows/${id}`, data);
export const publishWorkflow = (id) => api.post(`/workflows/${id}/publish`);
export const deleteWorkflow = (id) => api.delete(`/workflows/${id}`);

// ─── Runs ────────────────────────────────────────────────────────
export const getRuns = (params) => api.get('/runs', { params });
export const getRun = (id) => api.get(`/runs/${id}`);
export const getRunSteps = (id) => api.get(`/runs/${id}/steps`);
export const triggerRun = (workflowId, input) =>
  api.post(`/workflows/${workflowId}/trigger`, { input });

// ─── Approvals ───────────────────────────────────────────────────
export const getApprovals = (status) =>
  api.get('/approvals', { params: { status } });
export const resolveApproval = (id, action, resolvedBy, comment) =>
  api.post(`/approvals/${id}/resolve`, { action, resolvedBy, comment });

export default api;