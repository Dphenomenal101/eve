import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { pagePropsSchema } from "@/domain/schema";
export const pageCatalog = defineCatalog(schema, {
  components: {
    Stack: {
      props: pagePropsSchema,
      slots: ["default"],
      description: "A vertical container. Nest and order approved sections.",
    },
    Hero: {
      props: pagePropsSchema,
      description: "Opening headline grounded in the account brief.",
    },
    ContextBanner: {
      props: pagePropsSchema,
      description: "Relevant, visitor-safe context.",
    },
    Capabilities: {
      props: pagePropsSchema,
      description: "Approved product capabilities with sources.",
    },
    Steps: {
      props: pagePropsSchema,
      description: "A concise sequence of implementation steps.",
    },
    Proof: {
      props: pagePropsSchema,
      description:
        "An exact approved claim, with sourceIds. Never invent metrics.",
    },
    Offer: {
      props: pagePropsSchema,
      description: "An approved eligible offer, with sourceIds.",
    },
    FAQ: {
      props: pagePropsSchema,
      description: "Source-backed answers to relevant questions.",
    },
    CTA: {
      props: pagePropsSchema,
      description: "One approved HTTPS or mailto destination.",
    },
    Footer: {
      props: pagePropsSchema,
      description: "Company attribution and personalization disclosure.",
    },
  },
  actions: {},
});
