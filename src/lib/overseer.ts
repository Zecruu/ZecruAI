const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";

const PRE_MESSAGE_SYSTEM = `You are a security-aware AI overseer for a coding assistant. Given a user's message, decide if all file edits and command executions should be auto-approved. Approve coding tasks, builds, refactors, and standard dev work. Deny anything that could delete important data, run destructive commands (rm -rf /, drop database), or access sensitive credentials. Respond with JSON: {"autoApprove": boolean, "reasoning": "brief explanation"}`;

const POST_RESULT_SYSTEM = `You are an AI overseer for a coding assistant. A coding task just completed. Based on the result, decide if a follow-up action is needed (e.g., "start the dev server", "run the tests", "install dependencies"). Only suggest follow-ups when they're clearly the natural next step. Respond with JSON: {"action": "none" | "follow_up", "followUpMessage": "message to send to the coding assistant", "reasoning": "brief explanation"}`;

async function callAnthropic(apiKey: string, system: string, userContent: string): Promise<Record<string, unknown>> {
  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 256,
      system,
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || "{}";

  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in response");

  return JSON.parse(jsonMatch[0]);
}

export async function evaluateMessage(
  apiKey: string,
  message: string,
  projectName: string
): Promise<{ autoApprove: boolean; reasoning: string }> {
  const userContent = `Project: ${projectName}\n\nUser message: ${message}`;

  try {
    const result = await callAnthropic(apiKey, PRE_MESSAGE_SYSTEM, userContent);
    return {
      autoApprove: !!result.autoApprove,
      reasoning: (result.reasoning as string) || "No reasoning provided",
    };
  } catch {
    // On error, default to NOT auto-approving (safe fallback)
    return { autoApprove: false, reasoning: "Overseer evaluation failed, defaulting to manual review" };
  }
}

export async function evaluateResult(
  apiKey: string,
  result: string,
  projectName: string,
  originalMessage: string
): Promise<{ action: "none" | "follow_up"; followUpMessage?: string; reasoning: string }> {
  const userContent = `Project: ${projectName}\n\nOriginal task: ${originalMessage}\n\nResult: ${result}`;

  try {
    const parsed = await callAnthropic(apiKey, POST_RESULT_SYSTEM, userContent);
    return {
      action: parsed.action === "follow_up" ? "follow_up" : "none",
      followUpMessage: parsed.followUpMessage as string | undefined,
      reasoning: (parsed.reasoning as string) || "No reasoning provided",
    };
  } catch {
    return { action: "none", reasoning: "Overseer evaluation failed, no follow-up" };
  }
}

export async function validateApiKey(apiKey: string): Promise<boolean> {
  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 10,
      messages: [{ role: "user", content: "Hi" }],
    }),
  });

  return res.ok;
}
