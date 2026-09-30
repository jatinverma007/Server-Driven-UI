import { NextResponse } from "next/server";

/** Local development implementation of the production claims endpoint. */
export async function GET() {
  return NextResponse.json({
    approvedAmount: "42,500",
    rejectedAmount: "3,200",
    currency: "INR",
    approvedCount: 9,
    rejectedCount: 9,
  });
}
