// DISCLAIMER: These documents are a starting draft and have not been reviewed by
// a lawyer. Review before accepting payments.
import type { Metadata } from "next";
import { LegalPage, LegalSection, LegalList } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description:
    "The terms governing use of LastMilePrep, licence, intellectual property, prohibited conduct, pricing, liability, and grievance redressal.",
  alternates: { canonical: "/terms" },
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms & Conditions"
      intro="These Terms govern your access to and use of LastMilePrep. By using the service or purchasing access, you agree to them."
    >
      <LegalSection title="1. Who we are">
        <p>
          LastMilePrep (&ldquo;the service&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) is operated by{" "}
          <b>[[LEGAL_ENTITY_NAME]]</b>, registered at <b>[[REGISTERED_ADDRESS]]</b>. You can reach us at{" "}
          <a href="mailto:hello@lastmileprep.in" className="text-accent hover:underline">hello@lastmileprep.in</a>. These
          Terms are published in accordance with the Consumer Protection (E-Commerce) Rules, 2020.
        </p>
      </LegalSection>

      <LegalSection title="2. Eligibility">
        <p>
          You must be <b>18 years or older</b> to create an account or purchase access. Users under 18 may not use the
          service. By using it you confirm you meet this requirement.
        </p>
      </LegalSection>

      <LegalSection title="3. Licence to use the service">
        <p>
          Subject to these Terms and payment of applicable fees, we grant you a limited, personal, non-exclusive,
          non-transferable, revocable licence to access the service for your own exam preparation during your paid access
          period. This is a licence to use, <b>not a sale</b> of any content, software, or intellectual property, and no
          ownership passes to you.
        </p>
      </LegalSection>

      <LegalSection title="4. Intellectual property">
        <p>
          All content and systems that make up the service, including the question banks, interface design, report
          formats, the scoring methodology, algorithms, models, weightings, calibration logic, and the MarksenseAI engine
          in its entirety, are the exclusive property of <b>[[LEGAL_ENTITY_NAME]]</b> or its licensors and are protected by
          law.
        </p>
        <p>
          These proprietary systems are reserved to the owner. You may not, under any circumstance, copy, replicate,
          reverse-engineer, decompile, disassemble, derive works from, benchmark for commercial purposes, or reimplement
          any part of them. No provision of these Terms grants you any licence by implication, estoppel, or otherwise
          beyond the limited licence expressly stated above.
        </p>
      </LegalSection>

      <LegalSection title="5. Prohibited conduct">
        <p>You agree not to:</p>
        <LegalList
          items={[
            "Scrape, crawl, or use automated means to access the service, or extract questions or reports in bulk.",
            "Screen-record, reproduce, or redistribute questions, reports, or any part of the service.",
            "Share, resell, sublicense, or transfer your account or access; circumvent the one-time free-sample limit.",
            "Attempt to extract, infer, or reproduce the model behaviour, prompts, methodology, or scoring logic.",
            "Use the service, its questions, or its reports to build or train a competing product.",
          ]}
        />
        <p>Questions and reports are provided for the individual user&rsquo;s own preparation only.</p>
      </LegalSection>

      <LegalSection title="6. Enforcement">
        <p>
          We may suspend or terminate your access without refund for breach of these Terms. Where reasonable and the
          breach is capable of cure, we will give you a short period to remedy it before terminating.
        </p>
      </LegalSection>

      <LegalSection title="7. No guarantee of outcomes">
        <p>
          The service is a preparation tool. We make no representation or guarantee that using it will result in any
          particular score, rank, qualification, or selection in any examination.
        </p>
      </LegalSection>

      <LegalSection title="8. Accuracy and exam-pattern changes">
        <p>
          We make best efforts to match the current official exam pattern and marking, but provide the service &ldquo;as
          is&rdquo; with no warranty of accuracy. Examination bodies change patterns, syllabi, and marking without notice,
          and we are not responsible for such changes.
        </p>
      </LegalSection>

      <LegalSection title="9. No affiliation">
        <p>
          We are not affiliated with, endorsed by, or connected to the Staff Selection Commission (SSC), IBPS, SBI, NTA,
          NBE, UPSC, or any government body. All examination names and logos are the property of their respective owners
          and are used for identification only.
        </p>
      </LegalSection>

      <LegalSection title="10. Pricing and access period">
        <p>
          All-Access is <b>₹49 as a one-time early-access pass, granting full access until 31 October 2026</b>. After that
          date, All-Access is <b>₹99 per month</b>. The ₹49 pass does <b>not</b> auto-renew into a subscription without an
          affirmative act by you. Prices are inclusive of applicable taxes unless stated otherwise.
        </p>
      </LegalSection>

      <LegalSection title="11. Payments">
        <p>
          Payments are processed by our payment gateway, Razorpay. We do not store your card details. Razorpay&rsquo;s own
          terms and policies apply to the payment leg of any transaction.
        </p>
      </LegalSection>

      <LegalSection title="12. Service availability">
        <p>
          We do not guarantee uninterrupted availability. We may perform maintenance and may modify, suspend, or
          discontinue features at any time.
        </p>
      </LegalSection>

      <LegalSection title="13. Limitation of liability">
        <p>
          To the maximum extent permitted by law, our total liability arising out of or relating to the service is limited
          to the amount you actually paid to us (i.e. ₹49). We are not liable for indirect, incidental, special, or
          consequential loss. <b>Nothing in these Terms excludes or limits any liability that cannot lawfully be excluded
          or limited under applicable Indian law.</b>
        </p>
      </LegalSection>

      <LegalSection title="14. Indemnity">
        <p>
          You agree to indemnify and hold us harmless from any claim, loss, or expense arising out of your breach of these
          Terms or your misuse of the service.
        </p>
      </LegalSection>

      <LegalSection title="15. Grievance Officer">
        <p>
          In accordance with applicable law, our Grievance Officer is <b>[[GRIEVANCE_OFFICER_NAME]]</b>, reachable at{" "}
          <a href="mailto:hello@lastmileprep.in" className="text-accent hover:underline">hello@lastmileprep.in</a>. We
          acknowledge complaints within 48 hours and aim to resolve them within one month.
        </p>
      </LegalSection>

      <LegalSection title="16. Governing law and jurisdiction">
        <p>
          These Terms are governed by the laws of India. The courts at <b>[[JURISDICTION_CITY]]</b> have exclusive
          jurisdiction. GSTIN: <b>[[GSTIN_OR_OMIT]]</b>.
        </p>
      </LegalSection>

      <LegalSection title="17. General">
        <p>
          If any provision is held unenforceable, the rest remain in effect (severability). These Terms, with the
          policies they reference, are the entire agreement between you and us. We may amend them with notice; continued
          use after changes means acceptance. We may assign these Terms; you may not without our consent.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
