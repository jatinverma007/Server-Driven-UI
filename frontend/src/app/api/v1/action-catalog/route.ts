import { NextResponse } from "next/server";
import { ACTION_CATALOG } from "@/schema/catalog/actions";

export async function GET() {
  return NextResponse.json({ actions: ACTION_CATALOG });
}
