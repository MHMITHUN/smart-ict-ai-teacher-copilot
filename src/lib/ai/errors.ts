/**
 * Honest AI-layer errors. These are the ONLY errors the UI ever sees from
 * generation: a provider/transport failure or a validation failure after
 * the repair retry — never partially-trusted model output.
 */

export type AiErrorReason = "provider" | "validation";

export class AiGenerationError extends Error {
  readonly reason: AiErrorReason;
  readonly provider: string;
  readonly issues?: readonly string[];

  constructor(
    message: string,
    options: { reason: AiErrorReason; provider: string; issues?: readonly string[] },
  ) {
    super(message);
    this.name = "AiGenerationError";
    this.reason = options.reason;
    this.provider = options.provider;
    this.issues = options.issues;
  }
}
