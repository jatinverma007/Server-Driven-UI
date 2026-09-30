import { NextResponse } from "next/server";

/** Mock backing data for dataSourceId "invites.pending". Never referenced
 * by URL from a published configuration — see docs/architecture-review.md §6. */
export async function GET() {
  return NextResponse.json({
    invitedUserName: "Ananya Sharma",
    inviteMobileNo: "+91 98765 43210",
    avatarUrl: null,
  });
}
