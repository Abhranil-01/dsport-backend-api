import { QueueEvents } from "bullmq";
import { redis } from "../config/redis.js";
import { Order } from "../models/order.model.js";
import { getIO } from "../socket.js";

const invoiceQueueEvents = new QueueEvents("invoice-queue", {
  connection: redis,
});

invoiceQueueEvents.on("ready", () => {
  console.log("✅ Invoice QueueEvents is ready and listening");
});

invoiceQueueEvents.on("error", (err) => {
  console.error("🔥 QueueEvents error:", err);
});

invoiceQueueEvents.on("completed", async ({ jobId, returnvalue }) => {
  if (!returnvalue?.orderId) {
    return;
  }

  const order = await Order.findById(returnvalue.orderId).populate("user");

  if (!order) {
    return;
  }

  const io = getIO();

  const payload = {
    orderId: order._id.toString(),
    updates: {
      invoiceStatus: order.invoiceStatus,
      invoiceUrl: order.invoiceUrl,
    },
  };

  io.to("ADMIN").emit("ORDER_UPDATED", payload);

  io.to(`USER_${order.user._id}`).emit("ORDER_UPDATED", payload);
});

export default invoiceQueueEvents;
