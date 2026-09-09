/** Shared auth error — safe to import from client or server modules. */
export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403,
  ) {
    super(message);
    this.name = "AuthError";
  }
}
