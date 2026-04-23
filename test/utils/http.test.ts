import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithRetry, fetchJson, fetchText } from '../../src/utils/http.js';

describe('fetchWithRetry', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns response on first successful attempt', async () => {
    const mockResponse = new Response('ok', { status: 200 });
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse);

    const result = await fetchWithRetry('https://example.com/data');
    expect(result).toBe(mockResponse);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and succeeds on second attempt', async () => {
    const mockResponse = new Response('ok', { status: 200 });
    vi.mocked(fetch)
      .mockRejectedValueOnce(new TypeError('Network error'))
      .mockResolvedValueOnce(mockResponse);

    const result = await fetchWithRetry('https://example.com/data', { retries: 2 });
    expect(result).toBe(mockResponse);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting all retries', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Network error'));

    await expect(
      fetchWithRetry('https://example.com/data', { retries: 1 }),
    ).rejects.toThrow('Network error');

    expect(fetch).toHaveBeenCalledTimes(2); // initial + 1 retry
  });

  it('throws on non-ok HTTP status', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('Not Found', { status: 404, statusText: 'Not Found' }),
    );

    await expect(
      fetchWithRetry('https://example.com/data', { retries: 0 }),
    ).rejects.toThrow('HTTP 404');
  });

  it('does not retry permanent HTTP failures even when retries are available', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('Not Found', { status: 404, statusText: 'Not Found' }),
    );

    await expect(
      fetchWithRetry('https://example.com/data', { retries: 2 }),
    ).rejects.toThrow('HTTP 404');

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('retries transient HTTP failures such as 503', async () => {
    const ok = new Response('ok', { status: 200 });
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response('Busy', { status: 503, statusText: 'Service Unavailable' }),
      )
      .mockResolvedValueOnce(ok);

    const result = await fetchWithRetry('https://example.com/data', { retries: 1 });
    expect(result).toBe(ok);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('clears the abort timer on failed attempts', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

    await expect(
      fetchWithRetry('https://example.com/data', { retries: 0 }),
    ).rejects.toThrow('Network error');

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});

describe('fetchJson', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses JSON response', async () => {
    const data = { name: 'Aaron Judge', hr: 52 };
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(data), { status: 200 }),
    );

    const result = await fetchJson<typeof data>('https://example.com/api');
    expect(result).toEqual(data);
  });
});

describe('fetchText', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns text response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('pitch_type,speed\nFF,95.2', { status: 200 }),
    );

    const result = await fetchText('https://example.com/csv');
    expect(result).toBe('pitch_type,speed\nFF,95.2');
  });
});
