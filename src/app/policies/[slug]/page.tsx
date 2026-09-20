import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PolicyDocument from "@/components/policies/PolicyDocument";
import { POLICIES, formatEffectiveDate, getPolicy, readPolicyMarkdown } from "@/content/policies";

type Params = { params: { slug: string } };

export const dynamicParams = false;

export function generateStaticParams() {
  return POLICIES.map((policy) => ({ slug: policy.slug }));
}

export function generateMetadata({ params }: Params): Metadata {
  const doc = getPolicy(params.slug);
  if (!doc) return {};
  return {
    title: doc.title,
    description: doc.description,
    openGraph: { title: `${doc.title} — The Best Drug`, description: doc.description },
  };
}

export default function PolicyPage({ params }: Params) {
  const doc = getPolicy(params.slug);
  if (!doc) notFound();

  return (
    <article>
      <p className="text-[11px] uppercase tracking-[.14em] text-[#F5F5F0]/40">
        <Link href="/policies" className="transition hover:text-[#F5F5F0]">
          Terms &amp; policies
        </Link>
      </p>
      <h1 className="mt-2 font-display italic uppercase text-[34px] leading-[.95] tracking-[.04em] text-[#F5F5F0]">
        {doc.title}
      </h1>
      <p className="mt-2 text-[12px] text-[#F5F5F0]/50">
        Effective {formatEffectiveDate(doc.effectiveDate)}
      </p>
      <PolicyDocument markdown={readPolicyMarkdown(doc)} />
    </article>
  );
}
