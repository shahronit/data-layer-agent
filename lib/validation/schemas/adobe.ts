import type { EventSchema } from "../validator";

export const ADOBE_SCHEMAS: EventSchema[] = [
  {
    name: "adobe_page_view",
    eventNamePattern: /^(digitalData\.page|page_view)$/i,
    platform: "adobe",
    fields: [
      { path: "page.pageInfo.pageName", required: true, type: "string", description: "Page name" },
      { path: "page.pageInfo.pageType", required: false, type: "string", description: "Page type (e.g. product, category)" },
      { path: "page.pageInfo.language", required: false, type: "string", description: "Page language" },
    ],
  },
  {
    name: "adobe_product_view",
    eventNamePattern: /^(prodView|product.view|view.product)$/i,
    platform: "adobe",
    fields: [
      { path: "products", required: true, type: "string", description: "Products string (category;product;qty;price)" },
      { path: "events", required: true, type: "string", description: "Must contain prodView" },
    ],
    customValidation(payload: Record<string, unknown>) {
      const errors: { field: string; message: string; severity: "fail" | "warn" }[] = [];
      const events = String(payload.events || "");
      if (!events.includes("prodView")) {
        errors.push({ field: "events", message: "events string should contain 'prodView'", severity: "fail" });
      }
      return errors;
    },
  },
  {
    name: "adobe_cart_add",
    eventNamePattern: /^(scAdd|cart.add|add.to.cart)$/i,
    platform: "adobe",
    fields: [
      { path: "products", required: true, type: "string", description: "Products string" },
      { path: "events", required: true, type: "string", description: "Must contain scAdd" },
    ],
    customValidation(payload: Record<string, unknown>) {
      const errors: { field: string; message: string; severity: "fail" | "warn" }[] = [];
      const events = String(payload.events || "");
      if (!events.includes("scAdd")) {
        errors.push({ field: "events", message: "events string should contain 'scAdd'", severity: "fail" });
      }
      return errors;
    },
  },
  {
    name: "adobe_cart_remove",
    eventNamePattern: /^(scRemove|cart.remove|remove.from.cart)$/i,
    platform: "adobe",
    fields: [
      { path: "products", required: true, type: "string", description: "Products string" },
      { path: "events", required: true, type: "string", description: "Must contain scRemove" },
    ],
  },
  {
    name: "adobe_purchase",
    eventNamePattern: /^(purchase|order.complete|order.confirmation)$/i,
    platform: "adobe",
    fields: [
      { path: "products", required: true, type: "string", description: "Products string" },
      { path: "events", required: true, type: "string", description: "Must contain purchase" },
      { path: "purchaseID", required: true, type: "string", description: "Unique purchase/order ID" },
    ],
    customValidation(payload: Record<string, unknown>) {
      const errors: { field: string; message: string; severity: "fail" | "warn" }[] = [];
      const events = String(payload.events || "");
      if (!events.includes("purchase")) {
        errors.push({ field: "events", message: "events string should contain 'purchase'", severity: "fail" });
      }
      return errors;
    },
  },
  {
    name: "adobe_custom_link",
    eventNamePattern: /^(custom.link|link.click|_satellite\.track)$/i,
    platform: "adobe",
    fields: [
      { path: "linkName", required: false, type: "string", description: "Name of the custom link" },
      { path: "linkType", required: false, type: "string", description: "Link type (o=other, e=exit, d=download)" },
    ],
  },
  {
    name: "adobe_checkout",
    eventNamePattern: /^(scCheckout|checkout|begin.checkout)$/i,
    platform: "adobe",
    fields: [
      { path: "products", required: true, type: "string", description: "Products string" },
      { path: "events", required: true, type: "string", description: "Must contain scCheckout" },
    ],
  },
];
