/**
 * API client for FastAPI backend
 */

const API_BASE = "/api";

export class ApiError extends Error {
  constructor(
    status: number,
    statusText: string,
    body: any
  ) {
    super(`API Error [${status}] (${statusText}): ${body}`);
    this.name = "ApiError";
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: any
): Promise<T|null> {
  const url = `${API_BASE}${path}`;
  
  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    let errorBody;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = await response.text();
    }
    throw new ApiError(response.status, response.statusText, errorBody);
  }

  // Handle empty responses
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: any) => request<T>("POST", path, body),
  put: <T>(path: string, body?: any) => request<T>("PUT", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};
