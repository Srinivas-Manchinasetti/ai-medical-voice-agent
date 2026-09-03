import { NextResponse } from "next/server";
import { getDb } from "@/config/db";
import { consultationsTable } from "@/config/schema";
import { eq } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const dbClient = getDb();
    if (dbClient) {
      try {
        const records = await dbClient
          .select()
          .from(consultationsTable)
          .where(eq(consultationsTable.id, id))
          .limit(1);

        if (records.length > 0) {
          return NextResponse.json({ success: true, consultation: records[0] });
        }
      } catch (err) {
        console.warn("DB lookup error:", err);
      }
    }

    return NextResponse.json(
      { success: false, message: "Consultation report not found" },
      { status: 404 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
