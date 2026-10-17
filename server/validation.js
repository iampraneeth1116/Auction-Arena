// Thrown by route handlers; the error middleware in server/index.js turns it into a JSON response
export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
    // Written for users, so the message is safe to return even with a 5xx status
    this.expose = true;
  }
}

export function parseBody(schema, body) {
  const result = schema.safeParse(body ?? {});
  if (!result.success) {
    throw new HttpError(400, result.error.issues[0]?.message || 'Invalid request');
  }
  return result.data;
}
