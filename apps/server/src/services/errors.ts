export class AppHttpError extends Error {
  constructor(message: string, readonly statusCode: number, readonly code = "REQUEST_ERROR") {
    super(message);
    this.name = "AppHttpError";
  }
}

export const badRequest = (message: string) => new AppHttpError(message, 400, "INVALID_REQUEST");
export const notFound = (message: string) => new AppHttpError(message, 404, "NOT_FOUND");
export const conflict = (message: string) => new AppHttpError(message, 409, "CONFLICT");
