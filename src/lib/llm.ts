import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";

export const CHAT_MODEL = process.env.STANLEY_CHAT_MODEL || "claude-sonnet-5-5";
export const FAST_MODEL = process.env.STANLEY_FAST_MODEL || "claude-haiku-5-5";

// Adaptive thinking is on by default and its tokens count against max_tokens; callers size maxTokens for the JSON only.
const THINKING_HEADROOM = 4000;

let client: Anthropic | null = null;

export function hasKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function anthropic(): Anthropic {
  if (!hasKey()) throw new Error("ANTHROPIC_API_KEY is not set. Add it to .env.local.");
  return (client ??= new Anthropic());
}

export interface Turn {
  role: "user" | "assistant";
  content: string;
}

// Uses structured outputs so every model response is schema-shaped JSON. Newer models reject forced tool_choice.
export async function callTool<T>(opts: {
  model: string;
  system: string;
  messages: Turn[];
  tool: { name: string; description: string; schema: Record<string, unknown> };
  maxTokens?: number;
}): Promise<T> {
  const res = await anthropic().messages.parse({
    model: opts.model,
    max_tokens: (opts.maxTokens ?? 2000) + THINKING_HEADROOM,
    system: `${opts.system}\n\nRespond with JSON for ${opts.tool.name}: ${opts.tool.description}`,
    messages: opts.messages,
    output_config: { format: jsonSchemaOutputFormat(opts.tool.schema as Parameters<typeof jsonSchemaOutputFormat>[0]) },
  });
  if (res.parsed_output == null) throw new Error(`Model returned no ${opts.tool.name} output (stop_reason: ${res.stop_reason})`);
  return res.parsed_output as T;
}
