// Employer lead summary formatting.
// Presentation-only: no DB writes, no AI calls.

const ROLE_LABELS = {
  frontend_developer: "Frontend Developer",
  backend_developer: "Backend Developer",
  fullstack_developer: "Full Stack Developer",
  marketing_staff: "Marketing Staff",
  field_promoter: "Field Promoter",
  shopkeeper: "Shopkeeper",
  sales_staff: "Sales Staff",
  kitchen_staff: "Kitchen Staff",
  cook: "Cook",
  driver: "Driver",
  security_guard: "Security Guard",
  garage_worker: "Garage Worker",
  street_food_vendor: "Street Food Vendor",
  house_helper: "House Helper",
  waiter: "Waiter",
  cleaner: "Cleaner",
  helper: "General Helper",
  staff: "Staff"
};

export function formatEmployerRoleLabel(role = "") {
  const value = String(role || "").trim();

  if (!value) return "Staff";
  if (ROLE_LABELS[value]) return ROLE_LABELS[value];

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatEmployerHiringNeeds(needs = []) {
  if (!Array.isArray(needs) || !needs.length) {
    return "1 jana Staff";
  }

  if (needs.length === 1) {
    const need = needs[0];
    const label =
      need.roleLabel && !String(need.roleLabel).includes("_")
        ? need.roleLabel
        : formatEmployerRoleLabel(need.role);

    return `${Number(need.quantity || 1)} jana ${label}`;
  }

  return needs
    .map((need) => {
      const label =
        need.roleLabel && !String(need.roleLabel).includes("_")
          ? need.roleLabel
          : formatEmployerRoleLabel(need.role);

      return `- ${Number(need.quantity || 1)} jana ${label}`;
    })
    .join("\n");
}

export function buildEmployerLeadSummary({
  hiringNeeds = [],
  location = {},
  urgency = {}
} = {}) {
  const staffSummary = formatEmployerHiringNeeds(hiringNeeds);
  const areaLabel = location?.area || "-";
  const districtLabel = location?.district || "-";
  const urgencyValue = urgency?.urgency || "unknown";
  const urgencyLevel = urgency?.urgencyLevel || "unknown";

  if (Array.isArray(hiringNeeds) && hiringNeeds.length > 1) {
    return `✅ Staff:
${staffSummary}
✅ Location: ${areaLabel}, ${districtLabel}
✅ Urgency: ${urgencyValue}
✅ Priority: ${urgencyLevel}`;
  }

  return `✅ Staff: ${staffSummary}
✅ Location: ${areaLabel}, ${districtLabel}
✅ Urgency: ${urgencyValue}
✅ Priority: ${urgencyLevel}`;
}
