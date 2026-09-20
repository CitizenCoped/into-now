import type { Metadata } from "next";
import Link from "next/link";
import { POLICIES, formatEffectiveDate } from "@/content/policies";

export const metadata: Metadata = {
  title: "Terms & Policies — The Best Drug",
  description: "The Best Drug's Terms of Service, Safety Policy, and TAKE IT DOWN Act Policy.",
};

export default function PoliciesPage() {
  return (
    <section>
      <h1 className="font-display italic uppercase text-[34px] leading-none tracking-[.04em] text-[#F5F5F0]">
        Terms &amp; <span className="text-[#FF2D8A]">Policies</span>
      </h1>
      <p className="mt-3 text-[14px] leading-[1.6] text-[#F5F5F0]/60">
        The documents that govern The Best Drug. Questions? Write to{" "}
        <a
          href="mailto:contact@thebestdrug.com"
          className="text-[#FF2D8A] transition hover:text-[#00F0FF]"
        >
          contact@thebestdrug.com
        </a>
        .
      </p>

      <ul className="mt-8 flex flex-col gap-3">
        {POLICIES.map((policy) => (
          <li key={policy.slug}>
            <Link
              href={`/policies/${policy.slug}`}
              className="flex items-center justify-between gap-3 rounded-[14px] border border-[#FF2D8A]/45 bg-[#FF2D8A]/[.12] px-4 py-3.5 transition hover:bg-[#FF2D8A]/20"
            >
              <span className="min-w-0">
                <span className="block font-display italic uppercase text-[17px] leading-none tracking-[.04em] text-[#FF2D8A]">
                  {policy.title}
                </span>
                <span className="mt-1 block text-[12px] text-[#F5F5F0]/55">{policy.description}</span>
                <span className="mt-1 block text-[11px] text-[#F5F5F0]/40">
                  Effective {formatEffectiveDate(policy.effectiveDate)}
                </span>
              </span>
              <span className="shrink-0 text-[18px] text-[#FF2D8A]">→</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
