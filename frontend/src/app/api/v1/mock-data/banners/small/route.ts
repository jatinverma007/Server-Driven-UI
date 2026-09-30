import { NextResponse } from "next/server";

/** Mock backing data for dataSourceId "banners.small". */
export async function GET() {
  return NextResponse.json({
    banners: [{ id: "small_1", imageUrl: "https://uat1.omnicard.co.in/file-utils/zfwOTxl4.png", actionId: "open_omnis" }],
  });
}
