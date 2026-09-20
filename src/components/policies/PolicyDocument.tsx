import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const linkClass =
  "text-[#FF2D8A] underline decoration-[#FF2D8A]/40 underline-offset-2 transition hover:text-[#00F0FF] hover:decoration-[#00F0FF]/60";

/** react-markdown passes the hast `node`; strip it so it is never forwarded to the DOM. */
function domProps<T extends { node?: unknown }>(props: T): Omit<T, "node"> {
  const { node, ...rest } = props;
  void node;
  return rest;
}

const headingFace = "font-display italic uppercase tracking-[.04em] leading-none";

/**
 * Renders a legal document's markdown in the brand type system. The page
 * header owns the H1 (title, effective date), so `#` headings are dropped
 * here; `##` are section headings in the display face. Ordered lists stay
 * decimal at every depth because the text cites clauses like "section 22.3".
 */
const components: Components = {
  h1: () => null,
  h2: (props) => (
    <h2 className={`${headingFace} mb-3 mt-10 text-[22px] text-[#F5F5F0]`} {...domProps(props)} />
  ),
  h3: (props) => (
    <h3 className={`${headingFace} mb-2 mt-6 text-[17px] text-[#FF2D8A]`} {...domProps(props)} />
  ),
  p: (props) => (
    <p className="my-3 text-[15px] leading-[1.65] text-[#F5F5F0]/85 first:mt-0 last:mb-0" {...domProps(props)} />
  ),
  ol: (props) => (
    <ol className="my-2 list-decimal space-y-2 pl-6 marker:text-[#FF2D8A]/80" {...domProps(props)} />
  ),
  ul: (props) => (
    <ul className="my-2 list-disc space-y-2 pl-6 marker:text-[#FF2D8A]/80" {...domProps(props)} />
  ),
  li: (props) => (
    <li className="pl-1 text-[15px] leading-[1.65] text-[#F5F5F0]/85" {...domProps(props)} />
  ),
  strong: (props) => (
    <strong className="font-semibold text-[#F5F5F0]" {...domProps(props)} />
  ),
  hr: (props) => <hr className="my-8 border-[#F5F5F0]/10" {...domProps(props)} />,
  a: (allProps) => {
    const { href = "", children, ...props } = domProps(allProps);
    if (/^https?:\/\//.test(href)) {
      return (
        <a href={href} className={linkClass} target="_blank" rel="noopener noreferrer" {...props}>
          {children}
        </a>
      );
    }
    if (href.startsWith("/")) {
      return (
        <Link href={href} className={linkClass}>
          {children}
        </Link>
      );
    }
    return (
      <a href={href} className={linkClass} {...props}>
        {children}
      </a>
    );
  },
};

export default function PolicyDocument({ markdown }: { markdown: string }) {
  return (
    <div className="mt-6">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
