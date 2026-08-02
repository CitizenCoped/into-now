/**
 * PLACEHOLDER terms of service — written for the pre-public dev period.
 * Counsel review is scheduled; replace this text with attorney-approved
 * language before public launch.
 */
export const metadata = {
  title: "Terms of Use — into.now",
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-white/80">
      <h1 className="text-2xl font-bold text-white">Terms of Use</h1>
      <p className="mt-2 text-xs text-white/40">
        Draft — this platform is in limited pre-release testing.
      </p>

      <section className="mt-8 space-y-6 text-sm leading-relaxed">
        <div>
          <h2 className="mb-1 font-semibold text-[#FF8A1E]">Adults only</h2>
          <p>
            into.now is for adults 18 and older, without exception. Providing a
            false birth date is grounds for immediate and permanent removal.
          </p>
        </div>

        <div>
          <h2 className="mb-1 font-semibold text-[#FF8A1E]">Non-commercial, always</h2>
          <p>
            into.now exists for real, non-commercial connection between
            consenting adults. Offering or requesting paid services of any kind
            — including through coded language — is prohibited and enforced by
            automated screening and human review. Violations result in removal
            and may be reported to authorities where the law requires.
          </p>
        </div>

        <div>
          <h2 className="mb-1 font-semibold text-[#FF8A1E]">Consent and respect</h2>
          <p>
            Everyone here chose to be here; nobody chose to be harassed. No
            targeted harassment, no contacting people who have blocked you, no
            posting of anyone&apos;s private information or images without their
            consent.
          </p>
        </div>

        <div>
          <h2 className="mb-1 font-semibold text-[#FF8A1E]">
            Nonconsensual intimate imagery
          </h2>
          <p>
            We remove reported nonconsensual intimate imagery within 48 hours,
            consistent with federal law. Use the report tools in the app, or
            contact the operator directly, to start a removal request.
          </p>
        </div>

        <div>
          <h2 className="mb-1 font-semibold text-[#FF8A1E]">Moderation</h2>
          <p>
            We may remove content or accounts that violate these terms. Posts
            expire automatically after 24 hours. Moderation actions are logged.
          </p>
        </div>
      </section>
    </main>
  );
}
