/**
 * Bounded Promise execution for resilient offline/development fallback.
 * Prevents hanging fetches when local Supabase backend is unreachable.
 */
export async function withTimeout<T>(
  promise: Promise<T> | any,
  ms = 350,
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

