export const JOBMATE_KNOWLEDGE_PACK = {
  company: {
    whatIsJobMate:
      "JobMate Nepal ko AI-powered verified job platform ho. Yesle jobseekers ra employers lai skills, experience, location ra salary expectation ko aadhaar ma connect garna help garchha.",
    mission:
      "JobMate ko mission Nepal ko hiring chaos kam garera verified jobseekers lai verified employers sanga transparent ra trusted tarika le connect garnu ho.",
    focus:
      "JobMate Nepal bhar available huncha, tara field operation ra in-person employer verification ko primary focus aile Lumbini Province ho.",
    founder:
      "JobMate Bipin Devkota le start gareko platform ho. Ground operations Nepal/Lumbini ma local team/field agents bata support huncha.",
  },

  pricing: {
    jobseeker:
      "Jobseekers ko lagi JobMate free ho. Job search, apply, CV/document upload ra verification process jobseeker le free ma use garna sakchha.",
    employer:
      "Employer plans: Free NPR 0, Basic NPR 499/month, Premium NPR 999/month. Free ma 1 active job post, Basic ma 10 active posts, Premium ma unlimited posts ra featured listing jasta advanced features huncha.",
    payment:
      "Payment methods ma eSewa, Khalti, IME Pay, bank transfer ra Connect IPS support garna milcha.",
  },

  jobseeker: {
    gettingStarted:
      "Jobseeker le JobMate ma profile banayera location, skills, experience, expected salary, CV/document add garna sakchha. Profile complete bhaye matching ra employer trust badhcha.",
    apply:
      "Job search garepachhi suitable job select garera apply/interest submit garna milcha. Application status dashboard ma track garna milcha.",
    verification:
      "Verified jobseeker badge ko lagi citizenship card ya driving license upload garna milcha. Admin review/approval pachi verified badge dekhincha.",
  },

  employer: {
    gettingStarted:
      "Employer le company/business profile banayera job post garna sakchha. Job title, description, salary, location, job type ra deadline add garna parcha.",
    benefits:
      "Employer le AI candidate matching, applicant tracking, company profile, bulk email, featured listing ra analytics jasta tools use garna sakchha plan anusaar.",
    verification:
      "Verified employer badge ko lagi business registration, PAN/VAT, phone verification ra Lumbini Province ma field agent address verification use huncha.",
  },

  documents: {
    privacy:
      "Document pathaunu compulsory haina. Document verification/hiring process ko lagi matra use huncha. User comfortable chaina bhane document bina pani profile save garna milcha.",
    security:
      "JobMate sensitive documents public share gardaina. Document admin verification/hiring trust ko lagi use huncha. User le pachhi trust bhaye WhatsApp ma license, citizenship, CV ya certificate pathauna sakchha.",
    whenToAsk:
      "Driver/transport role ko lagi license useful huncha. Office/IT role ko lagi CV useful huncha. General identity verification ko lagi citizenship/nagarikta useful huncha.",
  },

  fieldOps: {
    summary:
      "JobMate field agents local businesses visit garera employer onboarding, hiring need collection, legitimacy verification ra follow-up support garchhan.",
    coverage:
      "Field operations currently Lumbini Province focus cha, especially Bardaghat, Butwal, Butaha ra surrounding areas.",
    gps:
      "Field agent visits GPS check-in, photos/notes, and admin review process bata verify garincha.",
  },

  support: {
    email:
      "General support ko lagi hello@jobmate.com.np ya support@jobmate.com.np ma contact garna milcha.",
    phone:
      "Nepal phone support office hours ma available huncha. Premium/support cases priority ma handle garincha.",
    human:
      "User lai human support chahiyo bhane JobMate team lai alert garna milcha.",
  },
};

export const JOBMATE_KNOWLEDGE_TOPICS = [
  {
    key: "pricing",
    patterns: [/price|pricing|paisa|kati|cost|plan|basic|premium|free|monthly|fee/i, /मूल्य|पैसा|शुल्क/i],
    answer: JOBMATE_KNOWLEDGE_PACK.pricing.employer,
  },
  {
    key: "jobseeker_free",
    patterns: [/jobseeker.*free|free.*jobseeker|job seeker.*paisa|kaam khojna paisa|apply.*free/i],
    answer: JOBMATE_KNOWLEDGE_PACK.pricing.jobseeker,
  },
  {
    key: "what_is_jobmate",
    patterns: [/jobmate.*ke ho|what is jobmate|jobmate kya hai|jobmate barema|about jobmate/i],
    answer: JOBMATE_KNOWLEDGE_PACK.company.whatIsJobMate,
  },
  {
    key: "founder",
    patterns: [/founder|owner|bipin|kasle banayo|kun company/i],
    answer: JOBMATE_KNOWLEDGE_PACK.company.founder,
  },
  {
    key: "document_privacy",
    patterns: [/document.*safe|document.*privacy|document.*leak|mero document|license safe|cv safe|citizenship safe|who will be responsible/i],
    answer: JOBMATE_KNOWLEDGE_PACK.documents.privacy,
  },
  {
    key: "verified_badge",
    patterns: [/verified badge|verify kasari|document verification|golden badge|green check|badge/i],
    answer: `${JOBMATE_KNOWLEDGE_PACK.jobseeker.verification}\n\nEmployer verification ko lagi business registration, PAN/VAT, phone verification ra field verification use huncha.`,
  },
  {
    key: "field_agent",
    patterns: [/field agent|field visit|agent visit|ground operation|gps|visit business/i],
    answer: `${JOBMATE_KNOWLEDGE_PACK.fieldOps.summary}\n\n${JOBMATE_KNOWLEDGE_PACK.fieldOps.coverage}`,
  },
  {
    key: "support",
    patterns: [/support|contact|phone|email|team sanga|help/i],
    answer: `${JOBMATE_KNOWLEDGE_PACK.support.email}\nHuman support chahiyo bhane "team" lekhnu hola.`,
  },
];
