import "dotenv/config";
import { Worker } from "bullmq";
import { redis } from "../config/redis.js";
import connectDB from "../db/index.js";
import { sendMail } from "../services/sendmail.service.js";

console.log("📧 Email Worker: Starting...");
await connectDB();
console.log("📧 Email Worker: DB Connected");

new Worker(
  "email-queue",
  async (job) => {
    console.log("📥 Email Job Received");
    console.log("🆔 Job ID:", job.id);
    console.log("📦 Job Data:", {
      to: job.data?.to,
      subject: job.data?.subject,
      hasHtml: !!job.data?.html,
      hasText: !!job.data?.text,
      attachmentsCount: job.data?.attachments?.length || 0,
    });

    try {
      const { to, subject, html, text, attachments } = job.data;

      console.log("📤 Sending email...");
      await sendMail({
        to,
        subject,
        html,
        text,
        attachments,
      });

      console.log("✅ Email Sent Successfully");
      console.log("🆔 Job ID:", job.id);

      return { status: "EMAIL_SENT" };
    } catch (err) {
      console.error("🔥 Email Worker Error");
      console.error("🆔 Job ID:", job.id);
      console.error("❌ Error Message:", err.message);
      console.error("📄 Stack:", err.stack);

      throw err; // important for BullMQ retry
    }
  },
  {
    connection: redis,
    concurrency: 10,
  }
);

console.log("📧 Email Worker: Listening on email-queue");
