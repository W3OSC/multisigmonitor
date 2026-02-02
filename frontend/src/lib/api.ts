const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:7111/api';

export interface Monitor {
  id: string;
  userId: string;
  safeAddress: string;
  network: string;
  settings: string;
  createdAt: string;
  updatedAt: string;
  lastCheckedAt?: string;
}

export interface CreateMonitorRequest {
  safeAddress: string;
  network: string;
  settings: {
    active: boolean;
    notificationChannels?: NotificationChannel[];
  };
}

export interface NotificationChannel {
  type: 'telegram' | 'webhook';
  chat_id?: string;
  url?: string;
  webhook_type?: 'discord' | 'slack' | 'generic';
}

export interface UpdateMonitorRequest {
  settings: Record<string, any>;
}

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`;
    try {
      const errorText = await response.text();
      if (errorText) {
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch {
          errorMessage = errorText;
        }
      }
    } catch {
      // Keep default error message
    }
    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const monitorsApi = {
  create: async (data: CreateMonitorRequest): Promise<Monitor> => {
    return fetchWithAuth(`${API_BASE_URL}/monitors`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  list: async (): Promise<Monitor[]> => {
    return fetchWithAuth(`${API_BASE_URL}/monitors`);
  },

  get: async (id: string): Promise<Monitor> => {
    return fetchWithAuth(`${API_BASE_URL}/monitors/${id}`);
  },

  update: async (id: string, data: UpdateMonitorRequest): Promise<Monitor> => {
    return fetchWithAuth(`${API_BASE_URL}/monitors/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: string): Promise<void> => {
    return fetchWithAuth(`${API_BASE_URL}/monitors/${id}`, {
      method: 'DELETE',
    });
  },
};

export interface NotificationRecord {
  id: number;
  transactionHash: string;
  safeAddress: string;
  network: string;
  monitorId: string;
  transactionType: string;
  notifiedAt: string;
}

export const notificationsApi = {
  list: async (): Promise<NotificationRecord[]> => {
    return fetchWithAuth(`${API_BASE_URL}/notifications`);
  },
};

export interface TransactionRecord {
  id: string;
  monitorId: string;
  safeTxHash: string;
  network: string;
  safeAddress: string;
  toAddress: string;
  value?: string;
  data?: string;
  operation?: number;
  nonce: number;
  isExecuted: boolean;
  submissionDate?: string;
  executionDate?: string;
  transactionData?: any;
  createdAt: string;
  updatedAt: string;
  securityAnalysis?: {
    id: string;
    isSuspicious: boolean;
    riskLevel: string;
    warnings: string[];
  };
}

export interface TransactionListQuery {
  safeAddress?: string;
  network?: string;
  limit?: number;
  offset?: number;
}

export const transactionsApi = {
  list: async (query?: TransactionListQuery): Promise<TransactionRecord[]> => {
    const params = new URLSearchParams();
    if (query?.safeAddress) params.append('safeAddress', query.safeAddress);
    if (query?.network) params.append('network', query.network);
    if (query?.limit) params.append('limit', query.limit.toString());
    if (query?.offset) params.append('offset', query.offset.toString());
    
    const url = `${API_BASE_URL}/transactions${params.toString() ? `?${params.toString()}` : ''}`;
    return fetchWithAuth(url);
  },

  get: async (id: string): Promise<TransactionRecord> => {
    return fetchWithAuth(`${API_BASE_URL}/transactions/${id}`);
  },
};

export interface SecurityAnalysisResult {
  id: string;
  safeAddress: string;
  network: string;
  transactionHash?: string;
  safeTxHash?: string;
  isSuspicious: boolean;
  riskLevel: string;
  warnings: any;
  details: any;
  callType?: any;
  hashVerification?: any;
  nonceCheck?: any;
  calldata?: any;
  analyzedAt: string;
  userId?: string;
}

export interface SafeAnalysisRequest {
  safeAddress: string;
  network: string;
  transaction: {
    to: string;
    value?: string;
    data?: string;
    operation?: number;
    nonce?: number;
  };
  chainId?: number;
  safeVersion?: string;
  previousNonce?: number;
}

export const securityApi = {
  listAnalyses: async (): Promise<SecurityAnalysisResult[]> => {
    return fetchWithAuth(`${API_BASE_URL}/security/analyses`);
  },

  getAnalysis: async (id: string): Promise<SecurityAnalysisResult> => {
    return fetchWithAuth(`${API_BASE_URL}/security/analyses/${id}`);
  },

  assessSafe: async (request: {
    safeAddress: string;
    network: string;
    safeInfo: any;
    creationInfo?: any;
    sanctionsResults?: any;
    multisigInfo?: any;
  }): Promise<any> => {
    return fetchWithAuth(`${API_BASE_URL}/security/safe-review`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  analyzeSafe: async (safeAddress: string, network: string, assessmentData: any): Promise<any> => {
    return fetchWithAuth(`${API_BASE_URL}/security/safe-review-legacy`, {
      method: 'POST',
      body: JSON.stringify({
        safeAddress,
        network,
        assessment: assessmentData,
      }),
    });
  },

  deleteAnalysis: async (id: string): Promise<void> => {
    return fetchWithAuth(`${API_BASE_URL}/security/analyses/${id}`, {
      method: 'DELETE',
    });
  },

  deleteAllAnalyses: async (): Promise<void> => {
    return fetchWithAuth(`${API_BASE_URL}/security/analyses`, {
      method: 'DELETE',
    });
  },
};

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
  isRevoked: boolean;
}

export interface CreateApiKeyRequest {
  name?: string;
}

export interface CreateApiKeyResponse {
  id: string;
  name: string;
  key: string;
  keyPrefix: string;
  createdAt: string;
  expiresAt: string;
}

export const apiKeysApi = {
  create: async (request: CreateApiKeyRequest): Promise<CreateApiKeyResponse> => {
    return fetchWithAuth(`${API_BASE_URL}/api-keys`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  list: async (): Promise<ApiKey[]> => {
    return fetchWithAuth(`${API_BASE_URL}/api-keys`);
  },

  revoke: async (id: string): Promise<void> => {
    return fetchWithAuth(`${API_BASE_URL}/api-keys/${id}`, {
      method: 'DELETE',
    });
  },
};

function getChainId(network: string): number {
  const chainIds: { [key: string]: number } = {
    'ethereum': 1,
    'sepolia': 11155111,
    'polygon': 137,
    'arbitrum': 42161,
    'optimism': 10,
    'base': 8453,
  };
  return chainIds[network.toLowerCase()] || 1;
}

export interface DashboardStats {
  activeMonitors: number;
  totalTransactions: number;
  suspiciousTransactions: number;
  recentAlerts: number;
  monitoredNetworks: string[];
}

export const dashboardApi = {
  getStats: async (): Promise<DashboardStats> => {
    return fetchWithAuth(`${API_BASE_URL}/dashboard/stats`);
  },
};
