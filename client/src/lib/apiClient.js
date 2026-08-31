import axios from 'axios';

const apiClient = axios.create({ baseURL: '/api/v1' });

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

function clearSessionAndRedirect() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

// Shared so a burst of concurrent 401s triggers only one refresh call.
let refreshPromise = null;

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    if (error.response?.status !== 401 || !original || original._retry) {
      return Promise.reject(error);
    }

    // A 401 from the refresh endpoint itself means the refresh token is dead.
    if (String(original.url || '').includes('/auth/refresh')) {
      clearSessionAndRedirect();
      return Promise.reject(error);
    }

    original._retry = true;
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      clearSessionAndRedirect();
      return Promise.reject(error);
    }

    try {
      if (!refreshPromise) {
        refreshPromise = axios
          .post('/api/v1/auth/refresh', { refresh_token: refreshToken })
          .then(({ data }) => {
            localStorage.setItem('access_token', data.data.access_token);
            localStorage.setItem('refresh_token', data.data.refresh_token);
            return data.data.access_token;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }
      const accessToken = await refreshPromise;
      original.headers = original.headers || {};
      original.headers.Authorization = `Bearer ${accessToken}`;
      return apiClient(original);
    } catch {
      clearSessionAndRedirect();
      return Promise.reject(error);
    }
  }
);

/**
 * Download a protected /uploads file with the bearer token and open it in a new tab.
 */
export async function openAuthenticatedFile(fileUrl) {
  const token = localStorage.getItem('access_token');
  const response = await fetch(fileUrl, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    throw new Error(`Failed to download file (${response.status})`);
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  window.open(objectUrl, '_blank', 'noopener,noreferrer');
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

export default apiClient;
