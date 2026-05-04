// Employer lead WhatsApp message templates.
// Presentation only: no DB, no AI, no state logic.

function greetingName(name) {
  const value = String(name || "").trim();
  return value ? `${value} ji` : "hajur";
}

function formatSalary(ai = {}) {
  if (ai.salaryMin && ai.salaryMax && ai.salaryMin !== ai.salaryMax) {
    return `NPR ${Number(ai.salaryMin).toLocaleString()}–${Number(ai.salaryMax).toLocaleString()}`;
  }

  if (ai.salaryMin || ai.salaryMax) {
    return `NPR ${Number(ai.salaryMin || ai.salaryMax).toLocaleString()}`;
  }

  return "-";
}

export const EMPLOYER_MESSAGES = {
  welcome: (name) =>
    `Hunchha ${greetingName(name)} 🙏

Staff/worker khojna ma sahayog garchhu.
Suruma tapai ko company/business ko naam pathaunu hola.`,

  askBusinessNameWithSummary: ({ name, ai = {} }) =>
    `Dhanyabaad ${greetingName(name)} 🙏

Tapai ko hiring requirement note bhayo:

👥 Role: ${ai.role || ai.keyword || "staff"}
🔢 Quantity: ${ai.quantity || 1}
📍 Location: ${ai.location || "-"}
💰 Salary: ${formatSalary(ai)}

Aba tapai ko business/company name pathaunu hola.`,

  askVacancy: (businessName) =>
    `Dhanyabaad 🙏
${businessName || "Tapai ko business"} ko details note gariyo.

Tapai lai kun role ko lagi kati jana staff chahinchha?

Example:
- 1 jana Frontend Developer
- 3 jana Driver
- 5 jana Security Guard
- 2 jana Kitchen Helper`,

  askRoleAfterQuantity: (quantity) =>
    `${quantity || 1} jana staff note gariyo 🙏

Kun role ko staff chahinchha?
Example:
- Frontend Developer
- Driver
- Security Guard
- Kitchen Helper`,

  askLocation: `Thik chha, details note gariyo. ✅

Tapai ko business kun area wa district ma chha?
Example: Bardaghat, Butwal, Bhairahawa, Parasi`,

  askUrgency: `Dhanyabaad. 👍

Tapailai employees kahile dekhi chahinchha?

1. Immediate / yo hapta
2. 1-2 hapta bhitra
3. Yo mahina bhitra
4. Exploring / bujhdai`,

  askSalaryRange: `Salary range kati samma dinu huncha?

Example:
- 15000-20000
- 18000 samma
- company anusar`,

  askWorkType: `Kaam type kasto ho?

1. Full-time
2. Part-time
3. Shift
4. Flexible`,

  completed: (name, summary) =>
    `Dhanyabaad ${greetingName(name)} 🙏

Tapai ko hiring details receive bhayo.

${summary}

Phone on rakhnu hola, hamro team le chhittai sampark garchha. 📞`,

  returning: () =>
    `Tapai ko business details hami sanga safe chha 🙏

Yedi thap vacancy wa new information dinu chha bhane yahin message pathaunu hola.`,
};
