/**
 * NVIDIA NIM LLM Client for MedVoice AI
 * 
 * Interacts with NVIDIA NIM OpenAI-compatible API endpoint:
 * https://integrate.api.nvidia.com/v1/chat/completions
 * 
 * Invariants:
 * 1. API key is read strictly from process.env.NVIDIA_API_KEY (never hardcoded).
 * 2. Emits structured dev logs proving live provider, model, and latency.
 * 3. Handles openai/gpt-oss-20b reasoning_content and strips any raw think tags.
 * 4. Resilient timeout with AbortController.
 */

export interface NvidiaChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface NvidiaCompletionOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  timeoutMs?: number;
}

export interface NvidiaCompletionResult {
  content: string;
  reasoning_content?: string;
  model: string;
  latencyMs: number;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class NvidiaClient {
  public getApiKey(): string {
    return process.env.NVIDIA_API_KEY || "";
  }

  public getBaseUrl(): string {
    return (process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1").replace(/\/$/, "");
  }

  public getDefaultModel(): string {
    return process.env.NVIDIA_MODEL || "openai/gpt-oss-20b";
  }

  public isConfigured(): boolean {
    const key = this.getApiKey();
    return Boolean(key && key.trim().length > 0);
  }

  public async createChatCompletion(
    messages: NvidiaChatMessage[],
    options: NvidiaCompletionOptions = {}
  ): Promise<NvidiaCompletionResult> {
    if (!this.isConfigured()) {
      throw new Error("NVIDIA_API_KEY is not configured in environment variables.");
    }

    const apiKey = this.getApiKey();
    const baseUrl = this.getBaseUrl();
    const model = options.model || this.getDefaultModel();
    const temperature = options.temperature ?? 0.2; // Low temperature for clinical rigor
    const max_tokens = options.max_tokens ?? 1024;
    const timeoutMs = options.timeoutMs ?? 30000;

    const endpoint = `${baseUrl}/chat/completions`;
    const t0 = Date.now();

    console.log(
      `[NVIDIA NIM] Calling endpoint: ${endpoint} | Model: ${model} | Messages: ${messages.length} | MaxTokens: ${max_tokens}`
    );

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens,
          stream: false,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - t0;

      if (!response.ok) {
        const errorText = await response.text();
        let errorCategory = "API_ERROR";
        let userFacingReason = `HTTP ${response.status} (${response.statusText})`;

        if (response.status === 401) {
          errorCategory = "AUTHENTICATION_ERROR";
          userFacingReason = "Invalid or expired NVIDIA API key. Please verify process.env.NVIDIA_API_KEY.";
        } else if (response.status === 402) {
          errorCategory = "QUOTA_EXHAUSTED";
          userFacingReason = "NVIDIA Developer Program free tier quota exhausted. Check your NVIDIA dashboard.";
        } else if (response.status === 429) {
          errorCategory = "RATE_LIMIT_EXCEEDED";
          userFacingReason = "NVIDIA NIM rate limit exceeded for free hosted developer tier. Backing off.";
        } else if (response.status >= 500) {
          errorCategory = "SERVER_ERROR";
          userFacingReason = `NVIDIA NIM upstream service error (${response.status}).`;
        }

        console.error(`[NVIDIA NIM ${errorCategory}] Status ${response.status}: ${userFacingReason}`);
        console.error(`[NVIDIA NIM RESPONSE BODY]:`, errorText.slice(0, 300));

        const err = new Error(`NVIDIA NIM [${errorCategory}]: ${userFacingReason}`);
        (err as any).status = response.status;
        (err as any).category = errorCategory;
        throw err;
      }

      const data = await response.json();
      const choice = data.choices?.[0];
      const message = choice?.message;

      // Extract content and optional reasoning_content (e.g. from openai/gpt-oss-20b)
      let content = message?.content || "";
      const reasoning_content = message?.reasoning_content || "";

      // Clean any <think> tags if present
      if (content.includes("<think>")) {
        content = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
      }

      // CRITICAL SAFETY INVARIANT: Never treat reasoning_content as patient-facing dialogue!
      // If content is empty, leave it empty so downstream strict JSON parser falls back to deterministic clinical plan.

      // If content looks like an unparsed internal chain-of-thought scratchpad, extract the final doctor quote
      if (/^(?:We need to|Let's think|The user asks|Answer:|So answer:|Count:)/i.test(content) || content.includes("Let's count:") || content.includes("Ensure 15-25 words") || content.includes("Count words:")) {
        const quoteMatches = Array.from(content.matchAll(/"([^"\n]{15,300})"/g));
        if (quoteMatches.length > 0) {
          // Take the last formulated quote that sounds like spoken doctor dialogue
          const spokenCandidates = quoteMatches
            .map((m: any) => (m[1] ? String(m[1]).trim() : ""))
            .filter(c => c && !c.startsWith("Wait,") && !c.includes("rule") && !c.includes("count") && !c.includes("Total "));
          if (spokenCandidates.length > 0) {
            content = spokenCandidates[spokenCandidates.length - 1];
          }
        }
      }

      // Strip any residual counting tokens (e.g., word(1), Facial(1), droop2) from model output
      content = content.replace(/([a-zA-Z]+)\(\d+\)/g, "$1").replace(/([a-zA-Z]+)\d+/g, "$1").trim();

      console.log(
        `[NVIDIA NIM SUCCESS] Model: ${model} | Latency: ${latencyMs}ms | Tokens: prompt=${data.usage?.prompt_tokens || 0}, completion=${data.usage?.completion_tokens || 0}`
      );

      return {
        content: content.trim(),
        reasoning_content,
        model,
        latencyMs,
        usage: data.usage,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      const latencyMs = Date.now() - t0;
      if (err.name === "AbortError") {
        console.error(`[NVIDIA NIM TIMEOUT] Request timed out after ${timeoutMs}ms`);
        throw new Error(`NVIDIA NIM request timed out after ${timeoutMs}ms`);
      }
      console.error(`[NVIDIA NIM FAILED] Latency: ${latencyMs}ms | Error:`, err.message);
      throw err;
    }
  }
}

export const nvidiaClient = new NvidiaClient();
