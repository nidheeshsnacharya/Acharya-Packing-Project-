import * as orderService from "../../services/order/orderEditService.js";

export async function handleAction(req, res) {
  try {
    const user = req.user;
    const { order_barcode, sku, tracking_number, order_id, updates } = req.body;

    let result;
    if (order_id && updates) {
      result = await orderService.editOrder(order_id, updates, user);
    } else if (order_barcode && !sku && !tracking_number) {
      result = await orderService.scanOrderBarcode(order_barcode, user);
    } else if (sku && !tracking_number) {
      result = await orderService.scanProduct(sku, user);
    } else if (tracking_number) {
      result = await orderService.scanTracking(tracking_number, user);
    } else {
      return res.status(400).json({
        error:
          "Invalid request. Provide either order_barcode, sku, tracking_number, or order_id with updates.",
      });
    }

    res.json(result);
  } catch (error) {
    console.error(error);
    const status = error.message.includes("not found")
      ? 404
      : error.message.includes("already")
        ? 409
        : error.message.includes("No active order")
          ? 400
          : 500;
    res.status(status).json({ error: error.message });
  }
}
