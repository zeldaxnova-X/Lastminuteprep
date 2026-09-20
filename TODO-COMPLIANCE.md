# Compliance TODOs (hard blockers)

## 🚫 BLOCKER — parental consent before NEET UG / JEE Main launch

The **Digital Personal Data Protection Act, 2023 (DPDP)** requires **verifiable
parental consent** before processing the personal data of anyone **under 18**, and
prohibits tracking and behavioural monitoring of children.

- **SSC CGL** candidates are graduates (18+), so today's 18+ restriction costs us
  nothing and we are compliant.
- **NEET UG** and **JEE Main** are different: a large share of those users are
  **16 or 17**. Launching either exam without a verifiable parental-consent flow
  would put us directly into DPDP non-compliance (and would also conflict with our
  Terms/Privacy/Ethical AI Policy, which currently state the service is 18+ only).

### Do NOT switch on NEET UG or JEE Main until ALL of the following exist:
1. Age capture at signup that routes under-18 users into a **verifiable parental
   consent** flow (not a self-declared checkbox).
2. A consent record tied to the parent/guardian, with audit trail and withdrawal.
3. **No behavioural tracking / profiling** of minors (DPDP prohibits it) — the
   MarksenseAI aggregate-improvement use must exclude minors' data unless separate
   lawful basis + parental consent is in place.
4. Terms, Privacy Policy and Ethical AI Policy updated to reflect minor handling
   (they currently say 18+ only).
5. Legal review of the whole minor-data flow.

Owner: founder. Raise this the moment NEET/JEE is scheduled, not at launch.

---

## Other pre-payment / pre-launch compliance items
- Fill every `[[PLACEHOLDER]]` in the legal pages (`/terms`, `/privacy-policy`,
  `/refund-policy`, `/ethical-ai-policy`) — see the checklist handed over with the
  landing overhaul. Legal entity name, registered address, jurisdiction city,
  grievance officer, GSTIN (or confirmed omission).
- Have a lawyer review all four legal documents before accepting live payments
  (each file carries a "not yet reviewed by a lawyer" disclaimer at the top).
- Confirm the pre-purchase consent checkbox (Terms + Privacy + no-refund) is
  stored with the order (timestamp + policy version) so the no-refund term is
  enforceable.
