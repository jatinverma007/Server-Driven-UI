// Phase 1 verification: validate the example fixtures against home-screen.schema.json.
// Run with: npm run schema:validate --workspace frontend  (or `node scripts/validate-fixtures.mjs` inside frontend/)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);

const schema = JSON.parse(readFileSync(path.join(root, "src/schema/home-screen.schema.json"), "utf8"));
const validate = ajv.compile(schema);

function check(label, file, expect) {
  const doc = JSON.parse(readFileSync(path.join(root, file), "utf8"));
  const ok = validate(doc);
  const pass = ok === expect;
  console.log(`${pass ? "PASS" : "FAIL"} — ${label}: expected ${expect ? "VALID" : "INVALID"}, got ${ok ? "VALID" : "INVALID"}`);
  if (!ok) {
    for (const err of validate.errors ?? []) {
      console.log(`   • ${err.instancePath || "(root)"} ${err.message}`);
    }
  }
  return pass;
}

let allPass = true;
allPass = check("home-screen.valid.json", "src/schema/examples/home-screen.valid.json", true) && allPass;
allPass = check("home-screen.invalid.json", "src/schema/examples/home-screen.invalid.json", false) && allPass;

if (!allPass) {
  console.error("\nFixture validation FAILED.");
  process.exit(1);
}
console.log("\nAll fixtures behave as expected against home-screen.schema.json.");
