import { Order } from "../models/order.model.js";

/**
 * Saves or updates fulfillment data in MongoDB
 */
export const handleFulfillmentData = async (payload, shopDomain) => {
  const shopifyId = String(payload.id);

  return await Order.findOneAndUpdate(
    {
      shop_domain: shopDomain,
      shopify_id: shopifyId,
    },
    {
      $set: {
        shop_domain: shopDomain,
        shopify_id: shopifyId,
        orderId: shopifyId,
        order_name: payload.name,
        email: payload.email,
        total_price: payload.total_price,
        fulfillment_status: payload.fulfillment_status,
        line_items: payload.line_items || [],
        fulfillments: payload.fulfillments || [],
        tracking: payload.fulfillments?.[0]
          ? {
              company: payload.fulfillments[0].tracking_company,
              number: payload.fulfillments[0].tracking_number,
              url: payload.fulfillments[0].tracking_url,
              scan_status: "pending",
            }
          : {},
        customer: payload.customer
          ? {
              first_name: payload.customer.first_name,
              last_name: payload.customer.last_name,
              email: payload.customer.email,
              phone: payload.customer.phone,
              id: String(payload.customer.id),
            }
          : {},
        raw_payload: payload,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        createdAt: new Date(),
        scan_status: "pending",
      },
    },
    { upsert: true, returnDocument: "after" },
  );
};
