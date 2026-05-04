import { JobApplication } from "../../models/JobApplication.model.js";

export async function upsertJobApplicationFromWorkerProfile({
  contact,
  worker,
  profile = {},
} = {}) {
  if (!contact?._id || !worker?._id) {
    return null;
  }

  if (!profile.isApplyingToSelectedJob || !profile.selectedJobId) {
    return null;
  }

  const selectedJob = profile.selectedJob || {};

  const update = {
    $setOnInsert: {
      contactId: contact._id,
      jobId: String(profile.selectedJobId || ""),
      source: "whatsapp_aarati",
      appliedAt: new Date(),
    },
    $set: {
      workerId: worker._id,
      phone: worker.phone || contact.phone || "",
      jobTitle: profile.selectedJobTitle || selectedJob.title || "",
      companyName:
        profile.selectedCompanyName ||
        selectedJob?.employer?.company_name ||
        selectedJob?.company_name ||
        "",
      location: selectedJob.location || profile.location || "",
      salaryMin: selectedJob.salary_min ?? null,
      salaryMax: selectedJob.salary_max ?? null,
      jobType: selectedJob.type || "",
      status: "interest_submitted",
      lastStatusAt: new Date(),
      metadata: {
        selectedJob,
        aaratiProfile: profile,
      },
    },
  };

  return JobApplication.findOneAndUpdate(
    {
      contactId: contact._id,
      jobId: String(profile.selectedJobId || ""),
    },
    update,
    {
      upsert: true,
      returnDocument: "after",
      setDefaultsOnInsert: true,
      runValidators: false,
    }
  );
}
