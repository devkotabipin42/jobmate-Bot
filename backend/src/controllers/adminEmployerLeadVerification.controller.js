import { EmployerLead } from "../models/EmployerLead.model.js";

export async function updateEmployerLeadVerification(req, res) {
  try {
    const { id } = req.params;
    const {
      verificationStatus,
      salaryVerified,
      phoneVerified,
      needsCall,
      hrNotes,
    } = req.body || {};

    const allowedStatuses = ["unverified", "needs_call", "called", "verified", "rejected"];

    const update = {
      $set: {},
    };

    if (verificationStatus) {
      if (!allowedStatuses.includes(verificationStatus)) {
        return res.status(400).json({
          success: false,
          message: "Invalid verificationStatus",
        });
      }

      update.$set.verificationStatus = verificationStatus;
    }

    if (typeof salaryVerified === "boolean") {
      update.$set.salaryVerified = salaryVerified;
    }

    if (typeof phoneVerified === "boolean") {
      update.$set.phoneVerified = phoneVerified;
    }

    if (typeof needsCall === "boolean") {
      update.$set.needsCall = needsCall;
    }

    if (typeof hrNotes === "string") {
      update.$set.hrNotes = hrNotes;
    }

    if (verificationStatus === "verified") {
      update.$set.needsCall = false;
      update.$set.leadStatus = "contacted";
    }

    if (verificationStatus === "rejected") {
      update.$set.needsCall = false;
      update.$set.leadStatus = "invalid";
    }

    const lead = await EmployerLead.findByIdAndUpdate(
      id,
      update,
      {
        returnDocument: "after",
        runValidators: false,
      }
    ).lean();

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Employer lead not found",
      });
    }

    return res.json({
      success: true,
      lead,
    });
  } catch (error) {
    console.error("Update employer verification failed:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update employer verification",
      error: error.message,
    });
  }
}
