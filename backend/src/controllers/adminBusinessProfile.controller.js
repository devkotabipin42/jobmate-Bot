import {
  getBusinessProfile,
  updateBusinessProfile,
  addBusinessService,
  deleteBusinessService,
  addBusinessFAQ,
  deleteBusinessFAQ,
} from "../services/admin/adminBusinessProfile.service.js";

export async function getAdminBusinessProfile(req, res) {
  try {
    const data = await getBusinessProfile();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("❌ Get business profile failed:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch business profile",
    });
  }
}

export async function patchAdminBusinessProfile(req, res) {
  try {
    const data = await updateBusinessProfile(req.body);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("❌ Update business profile failed:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to update business profile",
    });
  }
}

export async function postAdminBusinessService(req, res) {
  try {
    const data = await addBusinessService(req.body);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    console.error("❌ Add business service failed:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to add service",
    });
  }
}

export async function deleteAdminBusinessService(req, res) {
  try {
    const data = await deleteBusinessService(req.params.serviceId);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("❌ Delete business service failed:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to delete service",
    });
  }
}

export async function postAdminBusinessFAQ(req, res) {
  try {
    const data = await addBusinessFAQ(req.body);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    console.error("❌ Add business FAQ failed:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to add FAQ",
    });
  }
}

export async function deleteAdminBusinessFAQ(req, res) {
  try {
    const data = await deleteBusinessFAQ(req.params.faqId);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("❌ Delete business FAQ failed:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to delete FAQ",
    });
  }
}
