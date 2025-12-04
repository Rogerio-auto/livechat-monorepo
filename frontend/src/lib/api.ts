/**
 * API client configuration
 * Axios-like interface for API calls
 */

const API_BASE_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";

interface RequestConfig {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  credentials?: RequestCredentials;
}

interface ApiResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
}

class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async request<T = any>(
    endpoint: string,
    config: RequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    const { method = "GET", headers = {}, body, credentials = "include" } = config;

    const options: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      credentials,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw {
          response: {
            data: data || { error: response.statusText },
            status: response.status,
            statusText: response.statusText,
          },
        };
      }

      return {
        data,
        status: response.status,
        statusText: response.statusText,
      };
    } catch (error: any) {
      if (error.response) {
        throw error;
      }
      throw {
        response: {
          data: { error: error.message || "Network error" },
          status: 0,
          statusText: "Network Error",
        },
      };
    }
  }

  async get<T = any>(endpoint: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: "GET" });
  }

  async post<T = any>(endpoint: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: "POST", body: data });
  }

  async put<T = any>(endpoint: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: "PUT", body: data });
  }

  async patch<T = any>(endpoint: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: "PATCH", body: data });
  }

  async delete<T = any>(endpoint: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: "DELETE" });
  }
}

export const api = new ApiClient(API_BASE_URL);
export const API = API_BASE_URL;
