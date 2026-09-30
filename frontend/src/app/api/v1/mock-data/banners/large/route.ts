import { NextResponse } from "next/server";

/** Mock backing data for dataSourceId "banners.large". */
export async function GET() {
  return NextResponse.json({
    banners: [
      { id: "large_1", imageUrl: "https://uat1.omnicard.co.in/file-utils/RCconqBG.png", actionId: "open_brand_vouchers" },
      { id: "large_2", imageUrl: "https://uat1.omnicard.co.in/file-utils/Intf3P1p.png", actionId: "open_cashback" },
    ],
  });
}
