export class DomainException extends Error {
  constructor(
    message: string,
    readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'DomainException';
  }
}
