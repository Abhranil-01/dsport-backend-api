import { Queue } from "bullmq";
import { redis } from "../config/redis.js";

export const invoiceQueue = new Queue("invoice-queue", {
  connection: redis,
});
