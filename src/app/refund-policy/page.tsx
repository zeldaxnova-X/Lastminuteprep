// DISCLAIMER: These documents are a starting draft and have not been reviewed by
// a lawyer. Review before accepting payments.
import type { Metadata } from "next";
import { LegalPage, LegalSection, LegalList } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Cancellation & Refund Policy",
  description:
    "LastMilePrep sales are final. The reason, the three narrow exceptions, and how to raise them.",
  alternates: { canonical: "/refund-policy" },
  robots: { index: true, follow: true },
};

export default function RefundPolicyPage() {
  return (
    <LegalPage
      title="Cancellation & Refund Policy"
      intro="Please read this before you pay. In short: All-Access sales are final."
    >
      <LegalSection title="All sales are final">
        <p>
          All payments for All-Access are final. We do not offer refunds, cancellations, partial refunds, or pro-rating
          for unused access.
        </p>
      </LegalSection>

      <LegalSection title="Why">
        <p>
          All-Access is a digital product, delivered in full immediately on payment. We deliberately offer a{" "}
          <b>free full timed section</b> (25 questions, 15 minutes, no card, no sign-up) so you can evaluate the product
          before you buy. Because you can try it first and receive everything at once on purchase, payments are final.
        </p>
      </LegalSection>

      <LegalSection title="The only exceptions">
        <LegalList
          items={[
            "A duplicate charge for the same pass.",
            "An amount debited without access being granted.",
            "Any refund required by applicable law or by a competent authority.",
          ]}
        />
      </LegalSection>

      <LegalSection title="How to raise an exception">
        <p>
          Email{" "}
          <a href="mailto:hello@lastmileprep.in" className="text-accent hover:underline">hello@lastmileprep.in</a> with your
          Razorpay payment ID within 7 days of the charge. We acknowledge within 48 hours. Approved refunds are returned to
          the original payment method within 5 to 7 working days.
        </p>
      </LegalSection>

      <LegalSection title="No refund on termination for breach">
        <p>
          Where access is terminated for a breach of our Terms, no refund is due.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
