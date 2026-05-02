import { connectDB } from "./src/config/db.js";
import { generateBusinessReceptionistReply } from "./src/services/ai/businessReceptionistAI.service.js";

await connectDB();

const samples = [
  "sanchai hunuhunxa?",
  "khana khanu bhayo?",
  "hair color kati ho?",
  "location kata ho?",
  "discount milxa?",
  "booking garna milcha?",
];

for (const text of samples) {
  console.log("\nUSER:", text);
  const result = await generateBusinessReceptionistReply(text);
  console.log(result);
}

process.exit(0);
