import { NextResponse } from "next/server";
import { getDb } from "@/config/db";
import { consultationsTable } from "@/config/schema";
import { eq } from "drizzle-orm";
import { generateFHIRBundle, ConsultationRecordFHIR } from "@/lib/fhir/bundle";
import { memoryConsultations } from "../../route";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    let record: ConsultationRecordFHIR | null = null;

    const dbClient = getDb();
    if (dbClient) {
      try {
        const records = await dbClient
          .select()
          .from(consultationsTable)
          .where(eq(consultationsTable.id, id))
          .limit(1);

        if (records.length > 0) {
          record = records[0] as any;
        }
      } catch (err) {
        console.warn("DB lookup error for FHIR export:", err);
      }
    }

    if (!record) {
      const mem = memoryConsultations.find((c) => c.id === id);
      if (mem) {
        record = mem as any;
      }
    }

    if (!record) {
      // Return 404 if record doesn't exist
      return NextResponse.json(
        {
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "not-found",
              diagnostics: `Consultation with ID ${id} was not found in the EHR repository.`,
            },
          ],
        },
        {
          status: 404,
          headers: {
            "Content-Type": "application/fhir+json; charset=utf-8",
            "X-FHIR-Version": "4.0.1",
          },
        }
      );
    }

    // Generate valid HL7 FHIR R4 Bundle
    const bundle = generateFHIRBundle(record);

    return new Response(JSON.stringify(bundle, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/fhir+json; charset=utf-8",
        "X-FHIR-Version": "4.0.1",
        "Content-Disposition": `attachment; filename="fhir-bundle-${id}.json"`,
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "fatal",
            code: "exception",
            diagnostics: error?.message || "Internal server error during FHIR bundle serialization.",
          },
        ],
      },
      {
        status: 500,
        headers: {
          "Content-Type": "application/fhir+json; charset=utf-8",
        },
      }
    );
  }
}
