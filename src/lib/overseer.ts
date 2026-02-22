import type { ProjectContext, PrerequisiteItem } from "@/types";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";

const PRE_MESSAGE_SYSTEM = `You are a security-aware AI overseer for a coding assistant. You have two responsibilities:

1. SAFETY: Decide if file edits and command executions should be auto-approved. Approve coding tasks, builds, refactors, and standard dev work. Deny anything that could delete important data, run destructive commands (rm -rf /, drop database), or access sensitive credentials.

2. PREREQUISITES: Analyze the user's task and compare it against the project context provided. Identify any missing prerequisites the task needs (environment variables, npm packages, config files, etc.). Only flag things that are clearly required and clearly missing.

Respond with JSON:
{
  "autoApprove": boolean,
  "reasoning": "brief explanation",
  "prerequisites": [
    {"type": "env_var" | "dependency" | "config_file" | "other", "name": "ITEM_NAME", "reason": "why it's needed"}
  ]
}

The prerequisites array should be EMPTY if nothing is missing. Only include items that are genuinely required for the specific task AND not already present in the project context.`;

const POST_RESULT_SYSTEM = `You are an AI overseer for a coding assistant. A coding task just completed. Based on the result, decide if a follow-up action is needed (e.g., "start the dev server", "run the tests", "install dependencies"). Only suggest follow-ups when they're clearly the natural next step. Respond with JSON: {"action": "none" | "follow_up", "followUpMessage": "message to send to the coding assistant", "reasoning": "brief explanation"}`;

async function callAnthropic(apiKey: string, system: string, userContent: string, maxTokens: number = 256): Promise<Record<string, unknown>> {
  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
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
  projectName: string,
  projectContext?: ProjectContext | null
): Promise<{ autoApprove: boolean; reasoning: string; prerequisites: PrerequisiteItem[] }> {
  let userContent = `Project: ${projectName}\n\nUser message: ${message}`;

  if (projectContext) {
    userContent += `\n\nProject Context:
- Environment variables defined: ${projectContext.envKeys.length > 0 ? projectContext.envKeys.join(", ") : "none"}
- Dependencies: ${Object.keys(projectContext.dependencies).join(", ") || "none"}
- Dev dependencies: ${Object.keys(projectContext.devDependencies).join(", ") || "none"}
- NPM scripts: ${Object.keys(projectContext.scripts).join(", ") || "none"}
- Config files present: ${projectContext.configFiles.join(", ") || "none"}`;
  } else {
    userContent += `\n\nProject Context: unavailable (daemon not connected). Skip prerequisite checking.`;
  }

  try {
    const result = await callAnthropic(apiKey, PRE_MESSAGE_SYSTEM, userContent, 512);
    return {
      autoApprove: !!result.autoApprove,
      reasoning: (result.reasoning as string) || "No reasoning provided",
      prerequisites: Array.isArray(result.prerequisites) ? result.prerequisites as PrerequisiteItem[] : [],
    };
  } catch {
    // On error, default to NOT auto-approving (safe fallback)
    return { autoApprove: false, reasoning: "Overseer evaluation failed, defaulting to manual review", prerequisites: [] };
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
