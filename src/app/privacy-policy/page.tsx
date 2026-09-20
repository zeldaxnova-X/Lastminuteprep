// DISCLAIMER: These documents are a starting draft and have not been reviewed by
// a lawyer. Review before accepting payments.
import type { Metadata } from "next";
import { LegalPage, LegalSection, LegalList } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How LastMilePrep collects, uses, and protects your personal data, written against the Digital Personal Data Protection Act, 2023.",
  alternates: { canonical: "/privacy-policy" },
  robots: { index: true, follow: true },
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="This policy explains what personal data we collect, why, and your rights over it. It is written against the Digital Personal Data Protection Act, 2023 (DPDP)."
    >
      <LegalSection title="1. Data Fiduciary">
        <p>
          The Data Fiduciary is <b>[[LEGAL_ENTITY_NAME]]</b>, <b>[[REGISTERED_ADDRESS]]</b>. For any privacy matter,
          contact{" "}
          <a href="mailto:hello@lastmileprep.in" className="text-accent hover:underline">hello@lastmileprep.in</a>.
        </p>
      </LegalSection>

      <LegalSection title="2. What we collect">
        <LegalList
          items={[
            "Account identifiers, your email address and/or phone number.",
            "Payment reference data from Razorpay (a payment id and status). We never receive or store your card numbers.",
            "Mock attempt data, the answers you save, your confidence ratings, per-question timing, and navigation events.",
            "Device and browser metadata, and IP address.",
            "Any correspondence you send us for support.",
          ]}
        />
      </LegalSection>

      <LegalSection title="3. Why we use it (purpose by purpose)">
        <LegalList
          items={[
            "Delivering the test and running the CBT engine.",
            "Generating your performance reports.",
            "Operating the MarksenseAI engine on your own attempt data.",
            "Fraud and abuse prevention (including enforcing the one-time free sample).",
            "Meeting our statutory and legal obligations.",
            "Improving the service in de-identified, aggregate form.",
          ]}
        />
      </LegalSection>

      <LegalSection title="4. Legal basis and notice">
        <p>
          We process your personal data on the basis of your <b>consent</b>, given when you sign up and when you buy
          access, and for the purposes stated above. You may withdraw consent at any time by writing to us, though this may
          limit your ability to use the service. A Hindi version of this notice is forthcoming; until then this English
          notice governs.
        </p>
      </LegalSection>

      <LegalSection title="5. Your rights">
        <p>Under the DPDP Act you have the right to:</p>
        <LegalList
          items={[
            <>Access the personal data we hold about you, email hello@lastmileprep.in and we respond within 30 days.</>,
            <>Correct or update inaccurate data, request via hello@lastmileprep.in.</>,
            <>Erase your data, request account deletion via hello@lastmileprep.in.</>,
            <>Grievance redressal, raise a concern with our Grievance Officer at hello@lastmileprep.in (acknowledged within 48 hours).</>,
            <>Nominate another individual to exercise your rights in the event of death or incapacity, contact us to record a nomination.</>,
          ]}
        />
      </LegalSection>

      <LegalSection title="6. Retention">
        <p>
          We keep your account and attempt data while your account is active. If you delete your account, we delete or
          irreversibly de-identify your attempt data within 90 days, except where we must retain limited records (for
          example, payment records) to meet legal, tax, or accounting obligations, which we keep only for as long as the
          law requires.
        </p>
      </LegalSection>

      <LegalSection title="7. Processors we use">
        <p>We share the minimum necessary data with these categories of processors, under contract:</p>
        <LegalList
          items={[
            "Payment processing, Razorpay.",
            "Cloud hosting, Vercel.",
            "Analytics (privacy-respecting, no third-party behavioural advertising).",
            "Third-party machine-learning infrastructure providers operating under contractual confidentiality and data-processing obligations.",
          ]}
        />
      </LegalSection>

      <LegalSection title="8. Aggregate improvement use">
        <p>
          Your individual attempt data may be used in <b>de-identified, aggregated</b> form to improve the engine.
          Identifiable performance data is <b>never sold, rented, or disclosed</b> to any third party for their own
          purposes. You can ask to be excluded from aggregate improvement use by writing to us.
        </p>
      </LegalSection>

      <LegalSection title="9. No advertising, no data sale">
        <p>
          We do not sell your data, we do not run advertising, and we do not permit third-party behavioural tracking on
          the service.
        </p>
      </LegalSection>

      <LegalSection title="10. Security">
        <p>
          We apply reasonable technical and organisational measures to protect your data. We describe these only in
          general terms and do not disclose our architecture.
        </p>
      </LegalSection>

      <LegalSection title="11. Children">
        <p>
          The service is not offered to anyone under 18. We do not knowingly collect the personal data of minors. If we
          learn we have collected a minor&rsquo;s data, we delete it.
        </p>
      </LegalSection>

      <LegalSection title="12. Breach notification">
        <p>
          In the event of a personal data breach, we will notify the Data Protection Board and affected users as required
          by the DPDP Act.
        </p>
      </LegalSection>

      <LegalSection title="13. Cookies">
        <p>
          We use only strictly-necessary cookies to keep you signed in and to run the test. We do not set advertising or
          cross-site tracking cookies. If this changes, we will show a cookie notice and update this policy.
        </p>
      </LegalSection>

      <LegalSection title="14. Changes to this policy">
        <p>
          We may update this policy; the version and effective date at the top will change, and we will notify you of
          material changes by email or in-product notice.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
