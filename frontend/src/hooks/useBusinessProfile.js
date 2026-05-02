import { useEffect, useState } from "react";
import { adminService } from "../services/adminService";

export function useBusinessProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function fetchProfile() {
    try {
      setLoading(true);
      setError("");
      const data = await adminService.getBusinessProfile();
      setProfile(data);
    } catch (err) {
      setError(err.message || "Failed to load business profile");
    } finally {
      setLoading(false);
    }
  }

  async function updateProfile(payload) {
    try {
      setSaving(true);
      setError("");
      setMessage("");

      const data = await adminService.updateBusinessProfile(payload);
      setProfile(data);
      setMessage("Business profile saved.");
      return data;
    } catch (err) {
      setError(err.message || "Failed to save business profile");
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function addService(payload) {
    try {
      setSaving(true);
      setError("");
      setMessage("");

      const data = await adminService.addBusinessService(payload);
      setProfile(data);
      setMessage("Service added.");
      return data;
    } catch (err) {
      setError(err.message || "Failed to add service");
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function deleteService(serviceId) {
    try {
      setSaving(true);
      setError("");
      setMessage("");

      const data = await adminService.deleteBusinessService(serviceId);
      setProfile(data);
      setMessage("Service deleted.");
      return data;
    } catch (err) {
      setError(err.message || "Failed to delete service");
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function addFAQ(payload) {
    try {
      setSaving(true);
      setError("");
      setMessage("");

      const data = await adminService.addBusinessFAQ(payload);
      setProfile(data);
      setMessage("FAQ added.");
      return data;
    } catch (err) {
      setError(err.message || "Failed to add FAQ");
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function deleteFAQ(faqId) {
    try {
      setSaving(true);
      setError("");
      setMessage("");

      const data = await adminService.deleteBusinessFAQ(faqId);
      setProfile(data);
      setMessage("FAQ deleted.");
      return data;
    } catch (err) {
      setError(err.message || "Failed to delete FAQ");
      throw err;
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    fetchProfile();
  }, []);

  return {
    profile,
    loading,
    saving,
    error,
    message,
    refetch: fetchProfile,
    updateProfile,
    addService,
    deleteService,
    addFAQ,
    deleteFAQ,
  };
}
