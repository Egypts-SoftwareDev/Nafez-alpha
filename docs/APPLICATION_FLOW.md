Nafez Alpha — Campaign Application Flow (Egypt‑First)

Goals
- Collect all information needed to evaluate, approve, and launch a campaign.
- Help applicants succeed with clear guidance, examples, and validation.
- Minimize friction: multi‑step, save‑as‑you‑go, re‑editable drafts.

Reference (Kickstarter, Indiegogo)
- Common: Project basics, funding goal + deadline, story page, media, rewards/perks, risks, team, policies.
- Differences: Indiegogo has Fixed (all‑or‑nothing) and Flexible; Kickstarter is all‑or‑nothing only. Both require identity/KYC and payout setup; IGG supports “coming soon” pages.

Egypt‑first tailoring
- Currency: EGP everywhere, optional USD metadata.
- Identity: National ID, Governorate, phone; business option: CRN and Tax ID.
- Payouts: Bank account (IBAN/account), or mobile wallet (Fawry/Vodafone Cash) for small projects.
- Logistics: Local shipping options, regional delivery capability, Arabic/English content.
- Compliance: Restricted categories (medical claims, tobacco, gambling, etc.), proof of product feasibility for hardware.

Wizard steps (v1)
1) Eligibility & Basics
   - Title, Category, Location (Governorate/City), Language(s)
   - Funding model: Fixed (all‑or‑nothing) or Flexible
   - Goal (EGP), Duration (days)
2) Identity & Business
   - Applicant name, email (pre‑filled), phone, National ID
   - Business (optional): entity type, CRN, Tax ID, website/social
3) Story & Media
   - Short pitch (140 chars), Full description, Risks & challenges
   - Video URL (YouTube/Vimeo), up to 6 images
4) Rewards (optional for service/charity projects)
   - 1..n tiers: title, description, minimum amount (EGP), limit, estimated delivery
5) Budget & Compliance
   - Budget breakdown (percentages), use of funds, delivery plan
   - Confirm policy compliance, agree to Terms/Privacy
6) Review & Submit
   - Summary, missing items checklist, submit confirmation

Statuses
- draft → submitted → under_review → approved | rejected

MVP data model
{
  id, ownerEmail, status,
  basics: { title, category, locationGov, locationCity, languages, fundingModel, goalEGP, durationDays },
  identity: { name, nationalId, phone, business?: { entityType, crn, taxId, website, social } },
  story: { pitch, description, risks, videoUrl, images: [] },
  rewards: [ { title, description, amountEGP, limit, eta } ],
  budget: { items: [ { label, percent } ], notes },
  compliance: { confirmedPolicies, agreedTerms },
  createdAt, updatedAt
}

Next: implement endpoints and a multi‑step UI with draft save.

