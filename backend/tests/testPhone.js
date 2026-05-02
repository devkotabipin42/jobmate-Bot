import {
  normalizePhone,
  isValidNepalMobile,
  maskPhone,
} from "../src/utils/normalizePhone.js";

const samples = [
  "9800000000",
  "+977 9800000000",
  "977-9800000000",
  "009779800000000",
  "9700000000",
  "12345",
];

for (const sample of samples) {
  console.log({
    input: sample,
    normalized: normalizePhone(sample),
    valid: isValidNepalMobile(sample),
    masked: maskPhone(sample),
  });
}