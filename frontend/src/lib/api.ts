const BASE_URL = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export interface Customer {
  id: string;
  name: string;
  tier: string;
  health_score: number;
  total_events: number;
  error_rate: number;
  avg_latency: number;
  last_active: string | null;
  open_incidents?: number;
}

export interface EventData {
  id: number;
  timestamp: string;
  customer_id: string;
  service: string;
  event_type: string;
  severity: string;
  message: string;
  latency_ms: number | null;
  status_code: number | null;
}

export interface Incident {
  id: number;
  customer_id: string;
  detected_at: string;
  resolved_at: string | null;
  type: string;
  severity: string;
  title: string;
  ai_summary: string;
  root_cause: string;
  status: string;
}

export interface ServiceNode {
  id: string;
  name: string;
  dependencies: string[];
  health_score: number;
}

export interface MetricBucket {
  bucket: string;
  request_count: number;
  avg_latency: number;
  error_rate: number;
}

export interface EventStats {
  total_events: number;
  total_errors: number;
  avg_latency_ms: number;
}

export const api = {
  getCustomers: (sort_by = 'health_score') =>
    request<Customer[]>(`/customers?sort_by=${sort_by}`),

  getCustomer: (id: string) =>
    request<Customer>(`/customers/${id}`),

  getCustomerEvents: (id: string, limit = 50) =>
    request<EventData[]>(`/customers/${id}/events?limit=${limit}`),

  getCustomerMetrics: (id: string) =>
    request<MetricBucket[]>(`/customers/${id}/metrics`),

  getEvents: (limit = 100) =>
    request<EventData[]>(`/events?limit=${limit}`),

  getEventStats: () =>
    request<EventStats>(`/events/stats`),

  getIncidents: (params?: { customer_id?: string; status?: string }) => {
    const search = new URLSearchParams();
    if (params?.customer_id) search.set('customer_id', params.customer_id);
    if (params?.status) search.set('status', params.status);
    const qs = search.toString();
    return request<Incident[]>(`/incidents${qs ? `?${qs}` : ''}`);
  },

  getServices: () =>
    request<ServiceNode[]>(`/services`),
};
