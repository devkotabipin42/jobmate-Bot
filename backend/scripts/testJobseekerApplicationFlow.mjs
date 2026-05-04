import {
  filterSafeJobMatches,
} from "../src/services/jobmate/jobSearchSafety.service.js";
import {
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

const jobs = [
  {
    _id: "job1",
    title: "Frontend Developer",
    category: "IT/Tech",
    location: "Butwal",
    is_verified: true,
    is_active: true,
  },
  {
    _id: "job2",
    title: "Driver",
    category: "Driver/Transport",
    location: "Butwal",
    is_verified: true,
    is_active: true,
  },
];

assertEqual(
  "IT search only returns IT job",
  filterSafeJobMatches({
    jobs,
    requestedLocation: "Butwal",
    requestedJobType: "IT/Tech",
  }).map((job) => job.title),
  ["Frontend Developer"]
);

assertEqual(
  "Driver search only returns Driver job",
  filterSafeJobMatches({
    jobs,
    requestedLocation: "Butwal",
    requestedJobType: "Driver/Transport",
  }).map((job) => job.title),
  ["Driver"]
);

const mapped = buildWorkerProfileUpdateFromAaratiProfile({
  contact: {
    _id: "000000000000000000000001",
    phone: "9779800000000",
    displayName: "Mitra",
  },
  profile: {
    location: "Butwal",
    district: "Rupandehi",
    province: "Lumbini",
    jobType: "IT/Tech",
    availability: "full-time",
    documents: "yes",
    selectedJobId: "job1",
    selectedJobTitle: "Frontend Developer",
    selectedCompanyName: "test Company",
    isApplyingToSelectedJob: true,
  },
});

assertEqual(
  "selected job metadata saved into WorkerProfile update",
  {
    jobPreference: mapped.update.$addToSet.jobPreferences,
    availability: mapped.update.$set.availability,
    documentStatus: mapped.update.$set.documentStatus,
    selectedJobTitle: mapped.update.$set.metadata.selectedJobTitle,
    isApplyingToSelectedJob: mapped.update.$set.metadata.isApplyingToSelectedJob,
  },
  {
    jobPreference: "it_web",
    availability: "immediate",
    documentStatus: "ready",
    selectedJobTitle: "Frontend Developer",
    isApplyingToSelectedJob: true,
  }
);

console.log(`\nResult: ${failed === 0 ? "ALL PASSED" : `${failed} FAILED`}`);
if (failed > 0) process.exit(1);
