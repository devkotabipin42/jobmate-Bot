import { spawnSync } from "node:child_process";

const cases = [
  ["false", "false"],
  ["true", "true"],
  ["0", "false"],
  ["1", "true"],
];

let failed = 0;

for (const [input, expected] of cases) {
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      "import { env } from './src/config/env.js'; console.log(String(env.FOLLOWUP_WHATSAPP_SEND_ENABLED));",
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        FOLLOWUP_WHATSAPP_SEND_ENABLED: input,
      },
      encoding: "utf8",
    }
  );

  const actual = result.stdout.trim().split("\\n").pop();

  const pass = actual === expected;
  console.log(`\\n${pass ? "✅" : "❌"} FOLLOWUP_WHATSAPP_SEND_ENABLED=${input} -> ${actual}`);

  if (!pass) {
    failed += 1;
    console.log("Expected:", expected);
    console.log("stderr:", result.stderr);
  }
}

console.log(`\\nResult: ${failed === 0 ? "ALL PASSED" : `${failed} FAILED`}`);

if (failed > 0) {
  process.exit(1);
}
