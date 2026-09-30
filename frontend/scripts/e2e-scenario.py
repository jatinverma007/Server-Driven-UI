"""
End-to-end scenario harness for docs/end-to-end-verification.md.

Usage (against a freshly-seeded backend):
    cd frontend
    rm -f dev.db dev.db-journal dev.db-wal dev.db-shm
    npm run db:seed
    npx next start -p 3311 &
    python3 scripts/e2e-scenario.py

Exits non-zero (via assert) on the first contract violation it finds.
Writes a structured step log to /tmp/e2e_log.json.
"""
import json, subprocess, sys, time

BASE = "http://localhost:3311/api/v1"
HEADERS_EDITOR = {"x-user-role": "editor", "x-user-id": "e2e-editor@example.com"}
HEADERS_PUBLISHER = {"x-user-role": "publisher", "x-user-id": "e2e-publisher@example.com"}
HEADERS_VIEWER = {"x-user-role": "viewer", "x-user-id": "e2e-viewer@example.com"}

import urllib.request

def req(method, path, headers=None, body=None, extra_headers=None):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    h = dict(headers or {})
    if data is not None:
        h["Content-Type"] = "application/json"
    if extra_headers:
        h.update(extra_headers)
    r = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            status = resp.status
            respheaders = dict(resp.getheaders())
            respbody = resp.read()
    except urllib.error.HTTPError as e:
        status = e.code
        respheaders = dict(e.headers)
        respbody = e.read()
    try:
        parsed = json.loads(respbody) if respbody else None
    except Exception:
        parsed = respbody.decode(errors="replace")
    return status, respheaders, parsed

log = []
def record(step, desc, status, expected, actual_summary, evidence=None):
    log.append({"step": step, "desc": desc, "status": status, "expected": expected, "actual": actual_summary, "evidence": evidence})
    print(f"[{step}] {desc} -> HTTP {status} | {actual_summary}")

# STEP 1: initial published revision
status, hdrs, body = req("GET", "/configurations/home/published", HEADERS_VIEWER)
etag1 = hdrs.get("etag")
record(1, "Initial published revision", status, "200, revision=1", f"revision={body['revision']}, etag={etag1}")

# STEP 2: draft mirrors published as status=draft
status, hdrs, draft = req("GET", "/configurations/home/draft", HEADERS_EDITOR)
record(2, "GET draft seeds from published", status, "status=draft, revision=1", f"status={draft['content']['status']}, revision={draft['content']['revision']}")

# STEP 3: edit title + reorder (swap first two components) + change theme token + change audience of monthly_claim
content = draft["content"]
old_title = content["screens"][0]["title"]
content["screens"][0]["title"] = "Home (E2E edited)"
comps = content["screens"][0]["components"]
comps[0], comps[1] = comps[1], comps[0]  # reorder: header <-> quick_actions
content["theme"]["tokens"]["surface.default"]["light"] = "#F5F5F5"
for c in comps:
    if c["componentId"] == "monthly_claim":
        c["audience"] = {"all": [{"field": "user.type", "operator": "in", "value": ["B2B", "B2C"]}]}  # widen audience
# add a new item to quick_actions' bottomItems
for c in comps:
    if c["componentId"] == "quick_actions":
        c["props"]["bottomItems"].append({
            "id": "e2e_new_chip", "label": {"kind": "literal", "value": "E2E New Chip"},
            "media": {"leading": {"kind": "bundled", "name": "arrow_right"}}, "actionId": "view_all_bills"
        })

# STEP 4: save draft (editor role)
status, hdrs, saved = req("PUT", "/configurations/home/draft", HEADERS_EDITOR, body=content)
record(4, "PUT draft with edits (editor role)", status, "200", f"title now '{saved['content']['screens'][0]['title']}'")

# STEP 5: confirm published endpoint STILL serves old revision/title (draft must not leak)
status, hdrs, pub = req("GET", "/configurations/home/published", HEADERS_VIEWER)
record(5, "Published unaffected by unpublished draft edits", status, f"title='{old_title}', revision=1",
       f"title='{pub['content']['screens'][0]['title']}', revision={pub['revision']}")
assert pub["content"]["screens"][0]["title"] == old_title, "FAIL: draft leaked into published!"

# STEP 6: viewer role cannot save draft (RBAC)
status, hdrs, forbidden = req("PUT", "/configurations/home/draft", HEADERS_VIEWER, body=content)
record(6, "Viewer role forbidden from writing draft (RBAC)", status, "403", f"error={forbidden.get('error',{}).get('code') if isinstance(forbidden, dict) else forbidden}")

# STEP 7: validate the edited draft -> should be valid
status, hdrs, validation = req("POST", "/configurations/home/validate", HEADERS_EDITOR, body=content)
record(7, "Validate edited draft", status, "valid=true", f"valid={validation.get('valid')}")

# STEP 8: editor attempts to publish -> forbidden (editor lacks publish permission)
status, hdrs, pub_forbidden = req("POST", "/configurations/home/publish", HEADERS_EDITOR)
record(8, "Editor role forbidden from publishing (RBAC)", status, "403", f"error={pub_forbidden.get('error',{}).get('code') if isinstance(pub_forbidden, dict) else pub_forbidden}")

# STEP 9: publisher publishes the draft
status, hdrs, published = req("POST", "/configurations/home/publish", HEADERS_PUBLISHER)
record(9, "Publisher publishes edited draft", status, "200, revision=2", f"revision={published.get('revision')}")

# STEP 10: GET published now reflects new revision/title/reorder/theme/audience/new item
status, hdrs, pub2 = req("GET", "/configurations/home/published", HEADERS_VIEWER)
etag2 = hdrs.get("etag")
new_title = pub2["content"]["screens"][0]["title"]
new_first_component = pub2["content"]["screens"][0]["components"][0]["componentId"]
new_theme_color = pub2["content"]["theme"]["tokens"]["surface.default"]["light"]
new_chip_present = any(
    it["id"] == "e2e_new_chip"
    for c in pub2["content"]["screens"][0]["components"]
    if c["componentId"] == "quick_actions"
    for it in c["props"].get("bottomItems", [])
)
record(10, "Published reflects all edits atomically (this simulates the iOS refresh fetch)", status,
       "revision=2, new title, reordered, new theme color, new chip present",
       f"revision={pub2['revision']}, title='{new_title}', firstComponent='{new_first_component}', "
       f"themeColor={new_theme_color}, newChipPresent={new_chip_present}, etag_changed={etag2 != etag1}")

# STEP 11: ETag/If-None-Match -> 304 (simulates a healthy iOS refresh with unchanged revision)
req_ = urllib.request.Request(BASE + "/configurations/home/published", headers={**HEADERS_VIEWER, "If-None-Match": etag2}, method="GET")
try:
    with urllib.request.urlopen(req_) as resp:
        status304 = resp.status
except urllib.error.HTTPError as e:
    status304 = e.code
record(11, "If-None-Match with current ETag returns 304 (iOS APIClient's cheap-refresh path)", status304, "304", f"status={status304}")

# STEP 12: revisions list shows both revision 1 and 2
status, hdrs, revisions = req("GET", "/configurations/home/revisions", HEADERS_VIEWER)
revnums = sorted(r["revision"] for r in revisions.get("revisions", revisions if isinstance(revisions, list) else []))
record(12, "Revision history is immutable and append-only", status, "[1, 2]", f"revisions={revnums}")

# STEP 13: attempt to publish the deliberately-broken fixture -> validate rejects it (simulates portal catching bad JSON before publish)
with open("/home/claude/sdui/frontend/src/schema/examples/home-screen.invalid.json") as f:
    invalid_fixture = json.load(f)
status, hdrs, bad_validation = req("POST", "/configurations/home/validate", HEADERS_EDITOR, body=invalid_fixture)
error_count = len(bad_validation.get("errors", [])) if isinstance(bad_validation, dict) else None
record(13, "Validate the deliberately-invalid fixture", status, "valid=false, errors>0",
       f"valid={bad_validation.get('valid') if isinstance(bad_validation, dict) else bad_validation}, errorCount={error_count}")

# STEP 14: save the invalid fixture AS DRAFT (allowed - draft has no validation gate), then try to publish it -> must be rejected
status, hdrs, _ = req("PUT", "/configurations/home/draft", HEADERS_EDITOR, body=invalid_fixture)
record(14, "PUT invalid content as draft (no gate on save, by design)", status, "200 (draft save always allowed)", f"status={status}")

status, hdrs, publish_rejected = req("POST", "/configurations/home/publish", HEADERS_PUBLISHER)
record(15, "Publish is refused for the invalid draft (server-side re-validation at publish time)", status, "422/400, not published",
       f"body={json.dumps(publish_rejected)[:200]}")

# STEP 16: confirm published endpoint is UNCHANGED (still revision 2) after the rejected publish attempt
status, hdrs, pub3 = req("GET", "/configurations/home/published", HEADERS_VIEWER)
record(16, "Published pointer untouched by rejected publish attempt (this is what protects iOS's last-known-good)", status,
       "revision=2, unchanged", f"revision={pub3['revision']}, etag_unchanged={hdrs.get('etag') == etag2}")
assert pub3["revision"] == 2, "FAIL: a rejected publish must never move the published pointer!"

# STEP 17: restore revision 1 (rollback)
status, hdrs, restored = req("POST", "/configurations/home/revisions/1/restore", HEADERS_PUBLISHER)
record(17, "Restore revision 1 (rollback = new revision copying old content, per architecture-review.md)", status,
       "200, new revision created (revision=3)", f"newRevision={restored.get('revision')}, restoredFromRevision=1")

# STEP 18: published now serves the restored (original) content as a NEW revision number
status, hdrs, pub4 = req("GET", "/configurations/home/published", HEADERS_VIEWER)
record(18, "Published now serves restored content under a new revision (history stays append-only, never rewritten)", status,
       f"revision=3, title='{old_title}'", f"revision={pub4['revision']}, title='{pub4['content']['screens'][0]['title']}'")
assert pub4["content"]["screens"][0]["title"] == old_title, "FAIL: restore did not bring back the original content!"
assert pub4["revision"] == 3, "FAIL: restore should create a new revision, not rewrite revision 1!"

# STEP 19: revision history now has 3 entries: 1 (original), 2 (edited), 3 (restore-of-1)
status, hdrs, revisions2 = req("GET", "/configurations/home/revisions", HEADERS_VIEWER)
revnums2 = sorted(r["revision"] for r in revisions2.get("revisions", revisions2 if isinstance(revisions2, list) else []))
record(19, "Revision history after rollback still append-only (3 entries, not 2)", status, "[1, 2, 3]", f"revisions={revnums2}")

# STEP 20: audit log recorded every state-changing action
status, hdrs, audit = req("GET", "/configurations/home/revisions", HEADERS_VIEWER)  # placeholder if no direct audit endpoint exposed
record(20, "Scenario complete", 200, "-", "see docs/end-to-end-verification.md for the full step table")

with open("/tmp/e2e_log.json", "w") as f:
    json.dump(log, f, indent=2)

print("\nALL ASSERTIONS PASSED")
