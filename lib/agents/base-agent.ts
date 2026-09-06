import { AgentOpinion, AgentOpinionSchema, PatientCase } from "./schemas";

export interface AgentConfig {
  agentId: string;
  doctorName: string;
  specialty: string;
  systemPrompt: string;
  clinicalDomain: string;
}

/**
 * BASE CLINICAL AGENT
 * Wraps Groq Cloud API with structured JSON output enforcement,
 * fallback resilience, and empirical latency tracking.
 */
export abstract class BaseClinicalAgent {
  public readonly config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  /**
   * Filter and normalize patient context specifically for this specialist domain.
   * Invariant: Never dump raw unparsed vectors indiscriminately.
   */
  protected abstract extractSpecialtyContext(patientCase: PatientCase): Record<string, any>;

  /**
   * Fallback opinion generator if LLM API is unavailable or returns malformed JSON.
   */
  protected abstract generateDeterministicFallback(
    patientCase: PatientCase,
    specialtyContext: Record<string, any>
  ): AgentOpinion;

  public async evaluateCase(patientCase: PatientCase): Promise<{ opinion: AgentOpinion; latency_ms: number }> {
    const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
    const specialtyContext = this.extractSpecialtyContext(patientCase);

    const apiKey = process.env.GROQ_API_KEY || "";
    const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

    if (!apiKey) {
      // Offline / deterministic fallback
      const fallback = this.generateDeterministicFallback(patientCase, specialtyContext);
      const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
      return { opinion: fallback, latency_ms: Math.round(t1 - t0) };
    }

    try {
      const prompt = `You are ${this.config.doctorName}, specialist in ${this.config.specialty}.
Analyze this patient case strictly within your clinical domain.

PATIENT CLINICAL CONTEXT:
${JSON.stringify(specialtyContext, null, 2)}

INSTRUCTIONS:
1. Provide a strictly structured clinical opinion in valid JSON matching this schema:
{
  "agent": "${this.config.agentId}",
  "doctor_name": "${this.config.doctorName}",
  "specialty": "${this.config.specialty}",
  "concerns": ["list of primary differential or acute concerns"],
  "evidence": ["objective statements or signs supporting concerns"],
  "risk_level": "high" | "moderate" | "low",
  "recommended_actions": ["diagnostic or emergency actions"],
  "confidence": 0.0 to 1.0,
  "requires_escalation": boolean,
  "speech_observations_evaluated": ["observations on breathing pauses or acoustic distress"],
  "clinical_protocol": "name of standard protocol (e.g. ACS Accelerated Diagnostic Protocol, BE-FAST, etc.)"
}
2. Be rigorous. If life-threat red flags exist, flag risk_level="high" and requires_escalation=true.
3. Respond with JSON ONLY.`;

      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: this.config.systemPrompt },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
          max_tokens: 600,
        }),
        signal: AbortSignal.timeout(3500),
      });

      if (!res.ok) {
        throw new Error(`Groq API error status ${res.status}`);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      const parsed = JSON.parse(content);
      const opinion = AgentOpinionSchema.parse(parsed);

      const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
      return { opinion, latency_ms: Math.round(t1 - t0) };
    } catch (err) {
      // Fallback guarantees 100% operational availability
      const fallback = this.generateDeterministicFallback(patientCase, specialtyContext);
      const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
      return { opinion: fallback, latency_ms: Math.round(t1 - t0) };
    }
  }
}
