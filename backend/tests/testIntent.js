import { classifyIntent } from "../src/services/automation/intentClassifier.service.js";

const samples = [
  { phone: "9779800000000", messageType: "text", text: "job chaiyo" },
  { phone: "9779800000000", messageType: "text", text: "staff chahiyo" },
  { phone: "9779800000000", messageType: "text", text: "human sanga kura garna xa" },
  { phone: "9779800000000", messageType: "text", text: "stop" },
  { phone: "9779800000000", messageType: "text", text: "fake ho?" },
  { phone: "9779800000000", messageType: "image", text: "" },
  { phone: "9779800000000", messageType: "button", buttonId: "need_job" },
];

for (const sample of samples) {
  console.log(sample, "=>", classifyIntent(sample));
}