// Quiet generations for the Ledger's own jobs (repair, chronicle, archivist,
// simulator, sidecar, classifier, creator). Never re-enter the interceptor chain.

import type { LlmMessageDTO } from "lumiverse-spindle-types";
import { describe, has, host, warn } from "./host";

export interface QuietOptions {
  connectionId?: string;
  timeoutMs?: number;
  reasoningOff?: boolean;
  userId?: string;
  maxTokens?: number;
  label?: string;
}

export async function quiet(messages: LlmMessageDTO[], opts: QuietOptions = {}): Promise<string> {
  if (!has("generation")) throw new Error("the generation permission is not granted");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 90_000);
  try {
    const req: any = {
      type: "quiet",
      messages,
      signal: ctrl.signal,
      ...(opts.connectionId ? { connection_id: opts.connectionId } : {}),
      ...(opts.userId ? { userId: opts.userId } : {}),
      ...(opts.reasoningOff ? { reasoning: { source: "off" } } : {}),
      ...(opts.maxTokens ? { parameters: { max_tokens: opts.maxTokens } } : {}),
    };
    const res: any = await host.generate.quiet(req);
    const text = typeof res === "string" ? res : String(res?.content ?? res?.text ?? res?.message?.content ?? "");
    return text.trim();
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw new Error(`${opts.label ?? "generation"} timed out`);
    warn(`${opts.label ?? "generation"} failed: ${describe(err)}`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export function sys(content: string): LlmMessageDTO {
  return { role: "system", content };
}
export function usr(content: string): LlmMessageDTO {
  return { role: "user", content };
}
