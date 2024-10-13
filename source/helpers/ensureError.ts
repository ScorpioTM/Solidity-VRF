function ensureError(value: unknown): Error {
  if (value instanceof Error) return value;

  let stringified = '[Unable to stringify thrown value]';

  try {
    stringified = JSON.stringify(value);
  } catch { /* empty */ }

  return new Error(stringified);
}

export default ensureError;
