import { AgentOpinion, AgentOpinionSchema, PatientCase, ToolResult, PeerChallenge } from "./schemas";
import { Blackboard } from "./blackboard";
import { ClinicalToolRegistry } from "./tools/tool-registry";
import { DEFAULT_RUNTIME_POLICY } from "./runtime-policy";

export interface AgentConfig {
  agentId: string;
  doctorName: string;
  specialty: string;
  systemPrompt: string;
  clinicalDomain: string;
}

/**
 * BASE SPECIALIST CLINICAL AGENT
 * Operates over the shared Blackboard environment:
 * - Round 1: Reads evidence, invokes permitted domain tools, posts initial hypothesis.
 * - Round 2: Reviews peer hypotheses on the Blackboard, issues peer challenges, and revises findings.
 * - Respects bounded action limits (no disposition authority).
 */
export abstract class BaseClinicalAgent {
  public readonly config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  /**
   * Filter and normalize patient context specifically for this specialist domain.
   */
  protected abstract extractSpecialtyContext(patientCase: PatientCase, blackboard: Blackboard): Record<string, any>;

  /**
   * Select diagnostic tools to execute based on context and tool allowlist.
   */
  protected abstract selectToolsToExecute(patientCase: PatientCase, blackboard: Blackboard): string[];

  /**
   * Evaluate peer hypotheses from Blackboard in Round 2 and issue challenges if indicated.
   */
  protected abstract evaluatePeerChallenges(blackboard: Blackboard): PeerChallenge[];

  /**
   * Fallback opinion generator if LLM API is unavailable.
   */
  protected abstract generateDeterministicFallback(
    patientCase: PatientCase,
    specialtyContext: Record<string, any>,
    toolsRun: ToolResult[],
    round: number,
    challenges: PeerChallenge[]
  ): AgentOpinion;

  /**
   * Execute Round 1: Ingestion, Tool Invocation, Initial Hypothesis.
   */
  public async executeRound1(
    patientCase: PatientCase,
    blackboard: Blackboard
  ): Promise<{ opinion: AgentOpinion; latency_ms: number; tools_executed: ToolResult[] }> {
    const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
    const specialtyContext = this.extractSpecialtyContext(patientCase, blackboard);

    // 1. Tool execution under allowlist policy
    const toolsToCall = this.selectToolsToExecute(patientCase, blackboard).slice(0, DEFAULT_RUNTIME_POLICY.maxToolCallsPerRound);
    const toolResults: ToolResult[] = [];

    for (const toolName of toolsToCall) {
      const toolRes = ClinicalToolRegistry.executeTool(
        this.config.specialty.toLowerCase(),
        toolName,
        {
          transcript: patientCase.transcript,
          age: patientCase.demographics.age,
          ageGroup: patientCase.demographics.age_group,
          vitals: patientCase.vitals,
          hasChestPain: patientCase.pre_safety_flags.some(f => f.includes("CHEST")),
          currentMedications: []
        }
      );
      toolResults.push(toolRes);
      blackboard.recordToolResult(toolRes, this.config.agentId);
    }

    // 2. Formulate Round 1 Opinion
    const fallback = this.generateDeterministicFallback(patientCase, specialtyContext, toolResults, 1, []);
    blackboard.postOpinion(fallback);

    const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
    return { opinion: fallback, latency_ms: Math.round(t1 - t0), tools_executed: toolResults };
  }

  /**
   * Execute Round 2: Peer Cross-Examination & Hypothesis Revision.
   */
  public async executeRound2(
    patientCase: PatientCase,
    blackboard: Blackboard
  ): Promise<{ revisedOpinion: AgentOpinion; latency_ms: number; challengesIssued: PeerChallenge[] }> {
    const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
    const specialtyContext = this.extractSpecialtyContext(patientCase, blackboard);

    // 1. Generate challenges against peers
    const challengesIssued = this.evaluatePeerChallenges(blackboard);
    challengesIssued.forEach(c => blackboard.postChallenge(c));

    // 2. Check challenges received
    const challengesReceived = blackboard.getChallengesFor(this.config.agentId);

    // 3. Obtain existing tool runs from Blackboard
    const priorTools = blackboard.tool_results.filter(r =>
      this.selectToolsToExecute(patientCase, blackboard).includes(r.tool_name)
    );

    // 4. Formulate revised Round 2 Opinion
    const revised = this.generateDeterministicFallback(
      patientCase,
      specialtyContext,
      priorTools,
      2,
      challengesIssued
    );
    revised.challenges_issued = challengesIssued;
    revised.challenges_received = challengesReceived;
    blackboard.postOpinion(revised);

    const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
    return { revisedOpinion: revised, latency_ms: Math.round(t1 - t0), challengesIssued };
  }
}
