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
  helper_staff: "Helper",
  waiter: "Waiter",
  cleaner: "Cleaner",
  helper: "General Helper",
  staff: "Staff",
};

function formatSalaryRange({ salaryMin = null, salaryMax = null } = {}) {
  const min = Number(salaryMin || 0);
  const max = Number(salaryMax || 0);

  if (min && max && min !== max) {
    return `Rs ${min.toLocaleString("en-IN")} - ${max.toLocaleString("en-IN")}`;
  }

  if (max && !min) {
    return `Rs ${max.toLocaleString("en-IN")} samma`;
  }

  if (min || max) {
    return `Rs ${Number(min || max).toLocaleString("en-IN")}`;
  }

  return "-";
}

function formatWorkType(workType = "unknown") {
  const labels = {
    full_time: "Full-time",
    part_time: "Part-time",
    shift: "Shift",
    flexible: "Flexible",
    unknown: "-",
  };

  return labels[workType] || "-";
}

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
  urgency = {},
} = {}) {
  const staffSummary = formatEmployerHiringNeeds(hiringNeeds);
  const areaLabel = location?.area || "-";
  const districtLabel = location?.district || "-";
  const urgencyValue = urgency?.urgency || "unknown";
  const urgencyLevel = urgency?.urgencyLevel || "unknown";

  const firstNeed =
    Array.isArray(hiringNeeds) && hiringNeeds.length ? hiringNeeds[0] : {};

  const salaryText = formatSalaryRange({
    salaryMin: firstNeed.salaryMin,
    salaryMax: firstNeed.salaryMax,
  });

  const workTypeText = formatWorkType(firstNeed.workType);

  const extraLines = [
    salaryText !== "-" ? `✅ Salary: ${salaryText}` : "",
    workTypeText !== "-" ? `✅ Work Type: ${workTypeText}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const base =
    Array.isArray(hiringNeeds) && hiringNeeds.length > 1
      ? `✅ Staff:
${staffSummary}
✅ Location: ${areaLabel}, ${districtLabel}
✅ Urgency: ${urgencyValue}
✅ Priority: ${urgencyLevel}`
      : `✅ Staff: ${staffSummary}
✅ Location: ${areaLabel}, ${districtLabel}
✅ Urgency: ${urgencyValue}
✅ Priority: ${urgencyLevel}`;

  return extraLines ? `${base}\n${extraLines}` : base;
}
