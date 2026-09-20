// DISCLAIMER: These documents are a starting draft and have not been reviewed by
// a lawyer. Review before accepting payments.
import type { Metadata } from "next";
import { LegalPage, LegalSection, LegalList } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Ethical AI Policy",
  description:
    "How MarksenseAI is built and constrained, what it operates on, the controls we impose, and what we will not do.",
  alternates: { canonical: "/ethical-ai-policy" },
  robots: { index: true, follow: true },
};

export default function EthicalAiPolicyPage() {
  return (
    <LegalPage
      title="Ethical AI Policy"
      intro="MarksenseAI is the intelligence layer of LastMilePrep. This is our commitment to how it works and the limits we hold it to."
    >
      <LegalSection title="What MarksenseAI is for">
        <p>
          MarksenseAI has one purpose: helping a candidate turn their own performance data into better decisions in the
          exam hall. It is not a content generator, not a tutor bot, and not a chat interface pretending to be a person.
        </p>
      </LegalSection>

      <LegalSection title="What it operates on">
        <p>
          It works from your own attempt data, your answers, confidence ratings, timing, and question type. It does not
          use your identity, demographics, location, browsing behaviour, or anything bought from a third party.
        </p>
      </LegalSection>

      <LegalSection title="Controls we impose">
        <LegalList
          items={[
            "Analysis runs on de-identified attempt data; the engine does not receive your name, email, or phone number.",
            "No individual performance data is used for advertising, commercial profiling, or sale.",
            "No automated decision affects you outside the product, we never share scores with institutions, employers, or coaching centres.",
            "Aggregate improvement uses de-identified data only, and you can request exclusion by writing to hello@lastmileprep.in.",
            "Outputs are recommendations, never predictions of selection or guarantees of outcome.",
            "A human reviews the engine's outputs before any change to recommendation logic ships.",
            "The engine cannot write, alter, or delete your answers or scores.",
          ]}
        />
      </LegalSection>

      <LegalSection title="Transparency, without disclosing our method">
        <p>
          Every recommendation is derived from your own measurable behaviour, and on request we can explain the
          arithmetic behind a recommendation for <b>your own attempt</b>. The methodology, models, and weightings
          themselves remain proprietary and confidential. Both halves matter: you can check what applies to you, and our
          method stays closed.
        </p>
      </LegalSection>

      <LegalSection title="Infrastructure">
        <p>
          We use third-party machine-learning infrastructure under contractual confidentiality and data-protection terms.
          We do not disclose vendors.
        </p>
      </LegalSection>

      <LegalSection title="What we will not do">
        <LegalList
          items={[
            "No engagement-maximising design.",
            "No manufactured urgency based on inferred anxiety.",
            "No fabricated peer comparisons.",
            "No synthetic testimonials.",
            "No AI-generated content presented as human.",
            "No dark patterns in the upgrade flow.",
          ]}
        />
      </LegalSection>

      <LegalSection title="Reporting a concern">
        <p>
          Write to{" "}
          <a href="mailto:hello@lastmileprep.in" className="text-accent hover:underline">hello@lastmileprep.in</a>. We
          acknowledge within 48 hours.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
