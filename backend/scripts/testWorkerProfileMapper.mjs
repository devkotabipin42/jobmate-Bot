import {
  mapJobTypeToPreference,
  mapAvailabilityToWorkerEnum,
  mapDocumentsToWorkerEnum,
  buildWorkerProfileUpdateFromAaratiProfile,
} from "../src/services/jobmate/workerProfileMapper.service.js";

let failed = 0;

function assertEqual(name, actual, expected) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`\n${pass ? "✅" : "❌"} ${name}`);

  if (!pass) {
    failed += 1;
    console.log("Expected:", expected);
    console.log("Actual:", actual);
  }
}

assertEqual("driver job type", mapJobTypeToPreference("Driver/Transport"), "driver_transport");
assertEqual("frontend job type", mapJobTypeToPreference("Frontend Developer"), "it_web");
assertEqual("old full-time availability maps to immediate", mapAvailabilityToWorkerEnum("full-time"), "immediate");
assertEqual("part-time availability maps to not_decided", mapAvailabilityToWorkerEnum("part-time"), "not_decided");
assertEqual("shift availability maps to not_decided", mapAvailabilityToWorkerEnum("shift"), "not_decided");
assertEqual("any availability maps to not_decided", mapAvailabilityToWorkerEnum("any"), "not_decided");
assertEqual("2 week availability", mapAvailabilityToWorkerEnum("within_2_weeks"), "within_2_weeks");
assertEqual("documents yes", mapDocumentsToWorkerEnum("yes"), "ready");
assertEqual("documents partial", mapDocumentsToWorkerEnum("partial"), "available_later");
assertEqual("documents no", mapDocumentsToWorkerEnum("no"), "not_available");
assertEqual("documents privacy concern", mapDocumentsToWorkerEnum("privacy_concern"), "not_available");

const mapped = buildWorkerProfileUpdateFromAaratiProfile({
  contact: {
    _id: "000000000000000000000001",
    phone: "9779800000000",
    displayName: "Mitra",
  },
  profile: {
    jobType: "Driver/Transport",
    location: "Bardaghat",
    district: "Nawalparasi West",
    province: "Lumbini",
    availability: "full-time",
    documents: "yes",
  },
});

assertEqual("worker profile update core", {
  phone: mapped.update.$set.phone,
  area: mapped.update.$set["location.area"],
  district: mapped.update.$set["location.district"],
  availability: mapped.update.$set.availability,
  documentStatus: mapped.update.$set.documentStatus,
  jobPreference: mapped.update.$addToSet.jobPreferences,
}, {
  phone: "9779800000000",
  area: "Bardaghat",
  district: "Nawalparasi West",
  availability: "immediate",
  documentStatus: "ready",
  jobPreference: "driver_transport",
});

console.log(`\nResult: ${failed === 0 ? "ALL PASSED" : `${failed} FAILED`}`);

if (failed > 0) {
  process.exit(1);
}
