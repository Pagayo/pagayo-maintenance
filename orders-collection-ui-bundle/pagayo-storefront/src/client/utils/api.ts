/**
 * Pagayo Storefront - Typed API Client
 *
 * Enterprise-level fetch wrapper with:
 * - Full TypeScript support
 * - Error handling & retries
 * - Request/response interceptors
 * - Automatic JSON parsing
 * - CSRF token handling
 */

import { getCsrfToken } from "./csrf";

// ============================================
// Types
// ============================================

export interface ApiError {
  status: number;
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

export class ApiException extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiException";
  }

  static fromResponse(status: number, data: unknown): ApiException {
    if (typeof data === "object" && data !== null) {
      const payload = data as Record<string, unknown>;
      const nestedError =
        typeof payload.error === "object" && payload.error !== null
          ? (payload.error as Record<string, unknown>)
          : null;
      const message = payload.message ?? nestedError?.message;
      const code = payload.code ?? nestedError?.code;
      const details = payload.details ?? nestedError?.details;
      return new ApiException(
        status,
        (code as string) || "UNKNOWN_ERROR",
        (message as string) || "An error occurred",
        details as Record<string, unknown>
      );
    }
    return new ApiException(status, "UNKNOWN_ERROR", "An error occurred");
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  params?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  timeout?: number;
  retries?: number;
}

type RequestInterceptor = (
  config: RequestInit & { url: string }
) => RequestInit & { url: string };
type ResponseInterceptor = (response: Response) => Response | Promise<Response>;
type ErrorInterceptor = (error: ApiException) => ApiException | Promise<never>;

// ============================================
// API Client Class
// ============================================

class ApiClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];
  private errorInterceptors: ErrorInterceptor[] = [];
  private inFlightGetRequests = new Map<string, Promise<unknown>>();

  constructor(baseUrl = "/api") {
    this.baseUrl = baseUrl;
    this.defaultHeaders = {
      "Content-Type": "application/json",
    };
  }

  // Interceptor methods
  addRequestInterceptor(interceptor: RequestInterceptor): void {
    this.requestInterceptors.push(interceptor);
  }

  addResponseInterceptor(interceptor: ResponseInterceptor): void {
    this.responseInterceptors.push(interceptor);
  }

  addErrorInterceptor(interceptor: ErrorInterceptor): void {
    this.errorInterceptors.push(interceptor);
  }

  // Build URL with query params
  private buildUrl(
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined>
  ): string {
    const url = new URL(`${this.baseUrl}${endpoint}`, window.location.origin);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    return url.toString();
  }

  // Core request method
  private async request<T>(
    method: string,
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const {
      params,
      body,
      timeout = 30000,
      retries = 0,
      ...fetchOptions
    } = options;

    const url = this.buildUrl(endpoint, params);

    let config: RequestInit & { url: string } = {
      url,
      method,
      headers: { ...this.defaultHeaders, ...fetchOptions.headers },
      credentials: "same-origin",
      ...fetchOptions,
    };

    if (body !== undefined) {
      config.body = JSON.stringify(body);
    }

    // Apply request interceptors
    for (const interceptor of this.requestInterceptors) {
      config = interceptor(config);
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    config.signal = controller.signal;

    try {
      let response = await fetch(config.url, config);
      clearTimeout(timeoutId);

      // Apply response interceptors
      for (const interceptor of this.responseInterceptors) {
        response = await interceptor(response);
      }

      // Handle non-OK responses
      if (!response.ok) {
        let errorData: unknown;
        try {
          errorData = await response.json();
        } catch {
          errorData = { message: response.statusText };
        }

        const error = ApiException.fromResponse(response.status, errorData);

        // Apply error interceptors
        for (const interceptor of this.errorInterceptors) {
          await interceptor(error);
        }

        throw error;
      }

      // Parse response
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        return await response.json();
      }

      return response.text() as unknown as T;
    } catch (error) {
      clearTimeout(timeoutId);

      // Retry logic
      if (
        retries > 0 &&
        !(
          error instanceof ApiException &&
          error.status >= 400 &&
          error.status < 500
        )
      ) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return this.request(method, endpoint, {
          ...options,
          retries: retries - 1,
        });
      }

      if (error instanceof ApiException) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new ApiException(408, "TIMEOUT", "Request timed out");
      }

      throw new ApiException(0, "NETWORK_ERROR", "Network error occurred");
    }
  }

  // HTTP methods
  get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    const key = this.buildUrl(endpoint, options?.params);
    const existing = this.inFlightGetRequests.get(key);
    if (existing) return existing as Promise<T>;

    const request = this.request<T>("GET", endpoint, options).finally(() => {
      this.inFlightGetRequests.delete(key);
    });
    this.inFlightGetRequests.set(key, request);
    return request;
  }

  post<T>(
    endpoint: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    return this.request<T>("POST", endpoint, { ...options, body });
  }

  put<T>(
    endpoint: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    return this.request<T>("PUT", endpoint, { ...options, body });
  }

  patch<T>(
    endpoint: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    return this.request<T>("PATCH", endpoint, { ...options, body });
  }

  delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>("DELETE", endpoint, options);
  }
}

// ============================================
// Singleton Instance
// ============================================

export const api = new ApiClient();

// Add CSRF token interceptor - automatically adds CSRF token to state-changing requests
api.addRequestInterceptor((config) => {
  // Only add CSRF token for state-changing methods
  const stateChangingMethods = ["POST", "PUT", "PATCH", "DELETE"];

  if (stateChangingMethods.includes(config.method || "")) {
    const csrfToken = getCsrfToken();

    if (csrfToken) {
      // Add CSRF token to headers
      const headers = new Headers(config.headers);
      headers.set("X-CSRF-Token", csrfToken);
      config.headers = headers;
    }
  }

  return config;
});

// Add tenant parameter interceptor - ensures tenant from URL is included in all API calls
api.addRequestInterceptor((config) => {
  // Get tenant from URL if present
  const urlParams = new URLSearchParams(window.location.search);
  const tenant = urlParams.get("tenant");

  if (tenant) {
    const url = new URL(config.url, window.location.origin);
    if (!url.searchParams.has("tenant")) {
      url.searchParams.set("tenant", tenant);
    }
    config.url = url.toString();
  }

  return config;
});

// Add default error interceptor for 401 (unauthorized)
api.addErrorInterceptor((error) => {
  if (error.status === 401) {
    // Could trigger logout here
    window.dispatchEvent(new CustomEvent("auth:unauthorized"));
  }
  return error;
});
