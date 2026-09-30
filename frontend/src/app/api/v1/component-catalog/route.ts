import { NextResponse } from "next/server";
import { COMPONENT_CATALOG } from "@/schema/catalog/components";

export async function GET() {
  return NextResponse.json({ components: COMPONENT_CATALOG });
}
