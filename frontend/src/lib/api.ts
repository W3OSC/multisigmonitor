const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:7111/api';

export interface Monitor {
  id: string;
  user_id: string;
  safe_address: string;
  network: string;
  settings: string;
  created_at: string;
  updated_at: string;
  last_checked_at?: string;
}

export interface CreateMonitorRequest {
  safe_address: string;
  network: string;
  settings: {
    active: boolean;
    notification_channels?: NotificationChannel[];
  };
}

export interface NotificationChannel {
  channel_type: string;
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface UpdateMonitorRequest {
  settings: {
    active: boolean;
    notification_channels?: NotificationChannel[];
  };
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
    const error = await response.text();
    throw new Error(error || `HTTP ${response.status}`);
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
  transaction_hash: string;
  safe_address: string;
  network: string;
  monitor_id: string;
  transaction_type: string;
  notified_at: string;
}

export const notificationsApi = {
  list: async (): Promise<NotificationRecord[]> => {
    return fetchWithAuth(`${API_BASE_URL}/notifications`);
  },
};

export interface TransactionRecord {
  id: string;
  monitor_id: string;
  safe_tx_hash: string;
  network: string;
  safe_address: string;
  to_address: string;
  value?: string;
  data?: string;
  operation?: number;
  nonce: number;
  is_executed: boolean;
  submission_date?: string;
  execution_date?: string;
  transaction_data?: any;
  created_at: string;
  updated_at: string;
  security_analysis?: {
    id: string;
    isSuspicious: boolean;
    riskLevel: string;
    warnings: string[];
  };
}

export interface TransactionListQuery {
  safe_address?: string;
  network?: string;
  limit?: number;
  offset?: number;
}

export const transactionsApi = {
  list: async (query?: TransactionListQuery): Promise<TransactionRecord[]> => {
    const params = new URLSearchParams();
    if (query?.safe_address) params.append('safe_address', query.safe_address);
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

  analyzeSafe: async (safeAddress: string, network: string, assessmentData: any): Promise<any> => {
    return fetchWithAuth(`${API_BASE_URL}/security/safe-review`, {
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
  key_prefix: string;
  created_at: string;
  expires_at: string;
  last_used_at: string | null;
  is_revoked: boolean;
}

export interface CreateApiKeyRequest {
  name?: string;
}

export interface CreateApiKeyResponse {
  id: string;
  name: string;
  key: string;
  key_prefix: string;
  created_at: string;
  expires_at: string;
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
  active_monitors: number;
  total_transactions: number;
  suspicious_transactions: number;
  recent_alerts: number;
  monitored_networks: string[];
}

export const dashboardApi = {
  getStats: async (): Promise<DashboardStats> => {
    return fetchWithAuth(`${API_BASE_URL}/dashboard/stats`);
  },
};
