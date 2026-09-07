import { ToolResult } from "../schemas";
import {
  analyzeEcg,
  calculateTimiScore,
  computeBefast,
  computeNihssApprox,
  calculatePews,
  checkDrugInteractions
} from "./clinical-tools";

export const SPECIALIST_TOOL_ALLOWLISTS: Record<string, string[]> = {
  cardiology: ["analyze_ecg", "calculate_timi", "check_drug_interactions"],
  neurology: ["compute_befast", "compute_nihss", "check_drug_interactions"],
  pediatrics: ["calculate_pews", "check_drug_interactions"]
};

export class ClinicalToolRegistry {
  public static executeTool(
    specialty: string,
    toolName: string,
    params: Record<string, any>
  ): ToolResult {
    const allowed = SPECIALIST_TOOL_ALLOWLISTS[specialty] || [];
    if (!allowed.includes(toolName)) {
      return {
        tool_name: toolName,
        status: "skipped",
        clinical_summary: `Tool invocation rejected: "${toolName}" is not permitted under ${specialty} allowlist.`,
        output: { error: "TOOL_DISALLOWED_BY_POLICY", specialty, allowed },
        latency_ms: 0
      };
    }

    switch (toolName) {
      case "analyze_ecg":
        return analyzeEcg({
          transcript: params.transcript || "",
          vitals: params.vitals,
          hasChestPain: params.hasChestPain
        });
      case "calculate_timi":
        return calculateTimiScore({
          age: params.age,
          transcript: params.transcript || "",
          hasKnownCad: params.hasKnownCad
        });
      case "compute_befast":
        return computeBefast({
          transcript: params.transcript || ""
        });
      case "compute_nihss":
        return computeNihssApprox({
          transcript: params.transcript || ""
        });
      case "calculate_pews":
        return calculatePews({
          age: params.age,
          ageGroup: params.ageGroup,
          transcript: params.transcript || "",
          vitals: params.vitals
        });
      case "check_drug_interactions":
        return checkDrugInteractions({
          currentMedications: params.currentMedications,
          proposedMedications: params.proposedMedications,
          clinicalCondition: params.clinicalCondition,
          transcript: params.transcript
        });
      default:
        return {
          tool_name: toolName,
          status: "error",
          clinical_summary: `Unknown diagnostic tool: ${toolName}`,
          output: { error: "TOOL_NOT_FOUND" },
          latency_ms: 0
        };
    }
  }
}
