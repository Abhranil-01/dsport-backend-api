import { emailQueue } from "../queues/email.queues.js";

export const addEmailJob = async ({
  to,
  subject,
  html,
  text,
  attachments = [],
  priority = 3,
}) => {
  return emailQueue.add(
    "send-email",
    { to, subject, html, text, attachments },
    {
      priority,
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: true,
      removeOnFail: false,
    }
  );
};
