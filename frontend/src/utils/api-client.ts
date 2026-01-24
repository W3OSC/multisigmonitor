const API_URL = import.meta.env.VITE_API_URL;

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = new Error(`API Error: ${response.statusText}`) as any;
      error.status = response.status;
      throw error;
    }

    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return undefined as T;
    }

    return response.json();
  }

  async getMonitors() {
    return this.request('/monitors');
  }

  async getMonitor(id: string) {
    return this.request(`/monitors/${id}`);
  }

  async createMonitor(data: any) {
    return this.request('/monitors', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateMonitor(id: string, data: any) {
    return this.request(`/monitors/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteMonitor(id: string) {
    return this.request(`/monitors/${id}`, { method: 'DELETE' });
  }

  async getNotifications() {
    return this.request('/notifications');
  }

  async markNotificationAsRead(id: string) {
    return this.request(`/notifications/${id}`, { method: 'PUT' });
  }
}

export const apiClient = new ApiClient(API_URL);
