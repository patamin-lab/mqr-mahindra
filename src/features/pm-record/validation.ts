export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function parseJsonBody<T>(body: unknown): T {
  // TODO: add schema validation when zod is added to the project
  return body as T;
}

export function parseWithSchema<T>(_schema: unknown, data: unknown): T {
  // TODO: add runtime validation when zod is added to the project
  return data as T;
}
