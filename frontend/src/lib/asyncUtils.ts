/**
 * Resilient offline/development execution utilities with Circuit Breaker.
 * Prevents hanging fetches when local or remote Supabase backend is unreachable,
 * ensuring immediate 0ms-250ms responses instead of 30-second browser TCP timeouts.
 */

let backendOfflineUntil = 0;
let consecutiveFailures = 0;

export function isBackendCircuitOpen(): boolean {
  return Date.now() < backendOfflineUntil;
}

export function reportBackendSuccess(): void {
  consecutiveFailures = 0;
  backendOfflineUntil = 0;
}

export function reportBackendFailure(cooldownMs = 15000): void {
  consecutiveFailures++;
  backendOfflineUntil = Date.now() + cooldownMs;
}

/**
 * Resets the circuit breaker state (useful for manual refresh buttons or testing).
 */
export function resetBackendCircuit(): void {
  backendOfflineUntil = 0;
  consecutiveFailures = 0;
}

/**
 * Bounded Promise execution with fallback.
 */
export async function withTimeout<T>(
  promise: Promise<T> | any,
  ms = 250,
  fallbackValue?: T
): Promise<T> {
  let timerId: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<T>((resolve, reject) => {
    timerId = setTimeout(() => {
      if (fallbackValue !== undefined) {
        resolve(fallbackValue);
      } else {
        reject(new Error(`Operation timed out after ${ms}ms`));
      }
    }, ms);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timerId!);
    return result as T;
  } catch (err) {
    clearTimeout(timerId!);
    if (fallbackValue !== undefined) {
      return fallbackValue;
    }
    throw err;
  }
}

/**
 * Fast resilient query wrapper with circuit breaker.
 * When the backend is offline or unreachable, returns fallback data in 0ms without waiting.
 * When probing or online, races with a short 250ms timeout.
 */
export async function fastQuery<T>(
  queryPromise: Promise<T> | any,
  fallbackValue: T,
  timeoutMs = 250
): Promise<T> {
  // If circuit breaker is open (backend known to be offline), return fallback immediately in 0ms
  if (isBackendCircuitOpen()) {
    return fallbackValue;
  }

  try {
    const result = await withTimeout(queryPromise, timeoutMs);
    reportBackendSuccess();
    return result as T;
  } catch {
    reportBackendFailure(15000);
    return fallbackValue;
  }
}

/**
 * Resilient RPC and Mutation wrapper.
 * Tries the backend RPC/mutation with a bounded timeout (default 1200ms).
 * If the backend is unreachable (circuit open, TypeError: Failed to fetch, or timeout),
 * it immediately triggers the fallbackHandler to persist changes locally and return success.
 */
export async function resilientRpc<T>(
  rpcCall: () => Promise<T>,
  fallbackHandler: () => T | Promise<T>,
  timeoutMs = 1200
): Promise<T> {
  if (isBackendCircuitOpen()) {
    return (await fallbackHandler()) as T;
  }

  try {
    const result = await withTimeout<T>(rpcCall(), timeoutMs);
    // If the returned object has an error containing 'Failed to fetch', trigger fallback
    if (result && typeof result === 'object' && 'error' in result && (result as any).error) {
      const errStr = String((result as any).error);
      if (errStr.includes('fetch') || errStr.includes('Network') || errStr.includes('Failed to fetch')) {
        reportBackendFailure(20000);
        return (await fallbackHandler()) as T;
      }
    }
    reportBackendSuccess();
    return result as T;
  } catch (err: any) {
    reportBackendFailure(20000);
    return (await fallbackHandler()) as T;
  }
}

