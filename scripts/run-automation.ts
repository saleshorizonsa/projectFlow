import { PrismaClient } from "@prisma/client";
import { runAutomationEngine } from "../src/lib/automation-engine";

const prisma = new PrismaClient();

async function main() {
  const startedAt = new Date();
  const results = await runAutomationEngine(prisma, startedAt);
  const total = results.reduce((sum, result) => sum + result.count, 0);

  console.log(`[${startedAt.toISOString()}] ProjectFlow automation completed.`);
  console.log(`Items evaluated: ${total}`);
  for (const result of results) {
    console.log(`- ${result.name}: ${result.count}`);
  }
}

main()
  .catch((error) => {
    console.error("ProjectFlow automation failed.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
