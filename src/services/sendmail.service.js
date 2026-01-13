import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_MAIL,
    pass: process.env.SMTP_PASSWORD,
  },
});

export const sendMail = async ({
  to,
  subject,
  html,
  text,
  attachments = [],
}) => {
  const recipients = Array.isArray(to) ? to : [to];

  await transporter.sendMail({
    from: `"Dsport" <${process.env.SMTP_MAIL}>`,
    to: recipients.join(","),
    subject,
    html,
    text,
    attachments,
  });
};
