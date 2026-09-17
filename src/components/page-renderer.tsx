"use client";
import { defineRegistry, Renderer, JSONUIProvider } from "@json-render/react";
import { ArrowUpRight, Check, Command, Layers } from "lucide-react";
import { pageCatalog } from "@/lib/page-catalog";
import type { Dataset, PageSpec } from "@/domain/schema";
import type { CSSProperties } from "react";
const { registry } = defineRegistry(pageCatalog, {
  components: {
    Stack: ({ children }) => <div className="generated-stack">{children}</div>,
    Hero: ({ props }) => (
      <section className="generated-hero">
        <div className="generated-brand">
          <Layers size={20} />
          <span>{props.eyebrow}</span>
        </div>
        <span className="eyebrow">A STARTING POINT, JUST FOR YOU</span>
        <h1>{props.title}</h1>
        <p>{props.text}</p>
      </section>
    ),
    ContextBanner: ({ props }) => (
      <section className="generated-context">
        <span className="generated-icon">
          <Command size={21} />
        </span>
        <div>
          <h2>{props.title}</h2>
          <p>{props.text}</p>
        </div>
      </section>
    ),
    Capabilities: ({ props }) => (
      <section className="generated-section">
        <h2>{props.title}</h2>
        <p>{props.text}</p>
        <div className="generated-capabilities">
          {props.items?.map((x) => (
            <div key={x}>
              <Check size={17} />
              {x}
            </div>
          ))}
        </div>
      </section>
    ),
    Steps: ({ props }) => (
      <section className="generated-section">
        <span className="eyebrow">LESS FRICTION. MORE FORWARD.</span>
        <h2>{props.title}</h2>
        <div className="generated-steps">
          {props.items?.map((x, i) => (
            <div key={x}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              <p>{x}</p>
            </div>
          ))}
        </div>
      </section>
    ),
    Proof: ({ props }) => (
      <section className="generated-proof">
        <h2>{props.title}</h2>
        <blockquote>{props.text}</blockquote>
      </section>
    ),
    Offer: ({ props }) => (
      <section className="generated-offer">
        <span className="eyebrow">A LITTLE EXTRA HELP</span>
        <h2>{props.title}</h2>
        <p>{props.text}</p>
      </section>
    ),
    FAQ: ({ props }) => (
      <section className="generated-section">
        <h2>{props.title}</h2>
        {props.items?.map((x) => (
          <p className="generated-faq" key={x}>
            {x}
          </p>
        ))}
      </section>
    ),
    CTA: ({ props }) => (
      <section className="generated-cta">
        <h2>{props.title}</h2>
        <p>{props.text}</p>
        <a href={props.ctaHref} target="_blank" rel="noreferrer">
          {props.ctaLabel}
          <ArrowUpRight size={17} />
        </a>
      </section>
    ),
    Footer: ({ props }) => (
      <footer className="generated-footer">{props.text}</footer>
    ),
  },
});
export function PageRenderer({
  spec,
  brand,
  compact = false,
}: {
  spec: PageSpec;
  brand?: Dataset["brandProfiles"][number];
  compact?: boolean;
}) {
  return (
    <div
      className={`generated-page ${compact ? "generated-compact" : ""}`}
      style={
        {
          "--page-primary": brand?.primary ?? "#35664d",
          "--page-bg": brand?.background ?? "#fffefa",
          fontFamily: brand?.font === "serif" ? "Georgia, serif" : undefined,
          "--page-radius":
            brand?.radius === "none"
              ? "0"
              : brand?.radius === "round"
                ? "24px"
                : "6px",
        } as CSSProperties
      }
    >
      <JSONUIProvider registry={registry}>
        <Renderer spec={spec} registry={registry} />
      </JSONUIProvider>
    </div>
  );
}
