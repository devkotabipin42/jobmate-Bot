import { upsertJobApplicationFromWorkerProfile } from "../src/services/jobmate/jobApplication.service.js";

const contact = {
  _id: "000000000000000000000001",
  phone: "9779800000000",
};

const worker = {
  _id: "000000000000000000000002",
  phone: "9779800000000",
};

const noApplication = await upsertJobApplicationFromWorkerProfile({
  contact,
  worker,
  profile: {},
});

console.log("\n✅ no selected job returns:", noApplication);

if (noApplication !== null) {
  console.error("❌ Expected null when no selected job exists");
  process.exit(1);
}

console.log("\nResult: JobApplication service dry check passed");
