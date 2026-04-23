export interface FetchOptions {
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
}

const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_RETRIES = 2;

class HttpStatusError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpStatusError';
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function shouldRetry(error: Error): boolean {
  if (error instanceof HttpStatusError) {
    return isRetryableStatus(error.status);
  }

  return error.name === 'AbortError' || error instanceof TypeError;
}

export async function fetchWithRetry(
  url: string,
  options: FetchOptions = {},
): Promise<Response> {
  const { headers, timeout = DEFAULT_TIMEOUT, retries = DEFAULT_RETRIES } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new HttpStatusError(
          response.status,
          `HTTP ${response.status}: ${response.statusText} — ${url}`,
        );
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < retries && shouldRetry(lastError)) {
        // Exponential backoff: 1s, 2s
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      }

      throw lastError;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError ?? new Error(`Failed to fetch: ${url}`);
}

export async function fetchJson<T>(url: string, options?: FetchOptions): Promise<T> {
  const response = await fetchWithRetry(url, options);
  return response.json() as Promise<T>;
}

export async function fetchText(url: string, options?: FetchOptions): Promise<string> {
  const response = await fetchWithRetry(url, options);
  return response.text();
}
