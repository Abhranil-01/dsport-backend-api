import "dotenv/config";
import { Worker } from "bullmq";
import { redis } from "../config/redis.js";
import connectDB from "../db/index.js";
import { sendMail } from "../services/sendmail.service.js";

await connectDB();

new Worker(
  "email-queue",
  async (job) => {
    const { to, subject, html, text, attachments } = job.data;

    await sendMail({
      to,
      subject,
      html,
      text,
      attachments,
    });

    return { status: "EMAIL_SENT" };
  },
  {
    connection: redis,
    concurrency: 10,
  }
);
