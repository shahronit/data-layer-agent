import type { EventSchema } from "../validator";

const itemFields: EventSchema["fields"] = [
  { path: "items", required: true, type: "array", description: "Array of item objects" },
  { path: "items[].item_id", required: true, type: "string", description: "Product ID" },
  { path: "items[].item_name", required: true, type: "string", description: "Product name" },
];

const ecommerceBase: EventSchema["fields"] = [
  { path: "currency", required: true, type: "string", description: "ISO 4217 currency code" },
  { path: "value", required: true, type: "number", description: "Monetary value of the event" },
  ...itemFields,
];

export const GA4_SCHEMAS: EventSchema[] = [
  {
    name: "ga4_page_view",
    eventNamePattern: /^(page_view|gtm\.js|gtm\.load)$/,
    platform: "ga4",
    fields: [
      { path: "page_title", required: false, type: "string", description: "Page title" },
      { path: "page_location", required: false, type: "string", description: "Full URL" },
    ],
  },
  {
    name: "ga4_view_item",
    eventNamePattern: /^view_item$/,
    platform: "ga4",
    fields: [...ecommerceBase],
  },
  {
    name: "ga4_view_item_list",
    eventNamePattern: /^view_item_list$/,
    platform: "ga4",
    fields: [
      { path: "item_list_id", required: false, type: "string", description: "List ID" },
      { path: "item_list_name", required: false, type: "string", description: "List name" },
      ...itemFields,
    ],
    customValidation(payload: Record<string, unknown>) {
      if (!payload.item_list_id && !payload.item_list_name) {
        return [{ field: "item_list_id|item_list_name", message: "At least one of item_list_id or item_list_name is required", severity: "warn" as const }];
      }
      return [];
    },
  },
  {
    name: "ga4_select_item",
    eventNamePattern: /^select_item$/,
    platform: "ga4",
    fields: [
      { path: "item_list_id", required: false, type: "string", description: "List ID" },
      { path: "item_list_name", required: false, type: "string", description: "List name" },
      ...itemFields,
    ],
  },
  {
    name: "ga4_add_to_cart",
    eventNamePattern: /^add_to_cart$/,
    platform: "ga4",
    fields: [
      ...ecommerceBase,
      { path: "items[].quantity", required: true, type: "number", description: "Quantity added" },
    ],
    customValidation(payload: Record<string, unknown>) {
      const errors: { field: string; message: string; severity: "fail" | "warn" }[] = [];
      if (Array.isArray(payload.items) && typeof payload.value === "number") {
        const computedValue = payload.items.reduce((sum: number, item: Record<string, unknown>) => {
          const price = typeof item.price === "number" ? item.price : 0;
          const qty = typeof item.quantity === "number" ? item.quantity : 1;
          return sum + price * qty;
        }, 0);
        if (computedValue > 0 && Math.abs(computedValue - (payload.value as number)) > 0.01) {
          errors.push({ field: "value", message: `value (${payload.value}) does not match sum of items price*quantity (${computedValue.toFixed(2)})`, severity: "warn" });
        }
      }
      return errors;
    },
  },
  {
    name: "ga4_remove_from_cart",
    eventNamePattern: /^remove_from_cart$/,
    platform: "ga4",
    fields: [...ecommerceBase],
  },
  {
    name: "ga4_begin_checkout",
    eventNamePattern: /^begin_checkout$/,
    platform: "ga4",
    fields: [
      ...ecommerceBase,
      { path: "coupon", required: false, type: "string", description: "Coupon code" },
    ],
  },
  {
    name: "ga4_purchase",
    eventNamePattern: /^purchase$/,
    platform: "ga4",
    fields: [
      { path: "transaction_id", required: true, type: "string", description: "Unique transaction ID" },
      ...ecommerceBase,
      { path: "tax", required: false, type: "number", description: "Tax amount" },
      { path: "shipping", required: false, type: "number", description: "Shipping cost" },
    ],
  },
  {
    name: "ga4_add_to_wishlist",
    eventNamePattern: /^add_to_wishlist$/,
    platform: "ga4",
    fields: [...ecommerceBase],
  },
  {
    name: "ga4_search",
    eventNamePattern: /^search$/,
    platform: "ga4",
    fields: [
      { path: "search_term", required: true, type: "string", description: "Search query" },
    ],
  },
];
