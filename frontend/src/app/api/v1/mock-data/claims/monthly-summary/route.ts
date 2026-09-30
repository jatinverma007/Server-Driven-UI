import { NextResponse } from "next/server";

/** Mock backing data for dataSourceId "claims.monthlySummary" (B2B). */
export async function GET() {
  return NextResponse.json({ approvedAmount: "42,500", rejectedAmount: "3,200", currency: "INR", approvedCount: 9, rejectedCount: 9 });
}
