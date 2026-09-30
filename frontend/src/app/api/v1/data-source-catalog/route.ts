import { NextResponse } from "next/server";
import { DATA_SOURCE_CATALOG } from "@/schema/catalog/dataSources";

export async function GET() {
  // mockEndpoint is included here for portal/dev transparency only — it is
  // never part of the published HomeScreenConfiguration payload iOS receives.
  return NextResponse.json({ dataSources: DATA_SOURCE_CATALOG });
}
