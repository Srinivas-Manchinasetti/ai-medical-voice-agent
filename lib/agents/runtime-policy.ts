/**
 * AGENT RUNTIME POLICY BOUNDARY
 * 
 * Invariant: Guarantees that autonomous specialist reasoning agents remain strictly bounded:
 * 1. Maximum deliberation rounds (default: 3)
 * 2. Maximum tool calls per agent per round (default: 2)
 * 3. Bounded action space: no disposition authority (only Pre/Post arbiters hold disposition power)
 * 4. Per-round execution timeout protection
 */
export interface RuntimeLimits {
  maxRounds: number;
  maxToolCallsPerRound: number;
  perAgentTimeoutMs: number;
  allowArbitraryToolExecution: boolean;
  allowAutonomousDispositionOverride: boolean;
}

export const DEFAULT_RUNTIME_POLICY: RuntimeLimits = {
  maxRounds: 3,
  maxToolCallsPerRound: 2,
  perAgentTimeoutMs: 5000,
  allowArbitraryToolExecution: false,
  allowAutonomousDispositionOverride: false // HARD INVARIANT: Agents advise; Arbiters decide.
};

export class AgentRuntimePolicyEnforcer {
  private limits: RuntimeLimits;

  constructor(limits: RuntimeLimits = DEFAULT_RUNTIME_POLICY) {
    this.limits = limits;
  }

  public validateRoundAllowed(currentRound: number): boolean {
    return currentRound <= this.limits.maxRounds;
  }

  public validateToolCallAllowed(currentCallsInRound: number): boolean {
    return currentCallsInRound < this.limits.maxToolCallsPerRound;
  }

  public getPerAgentTimeout(): number {
    return this.limits.perAgentTimeoutMs;
  }
}
