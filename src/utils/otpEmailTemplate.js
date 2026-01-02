export const otpEmailTemplate = (otp) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Dsport Login OTP</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f6f8; font-family:Arial, Helvetica, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:40px 0;">
        <table width="100%" max-width="500" style="background:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background:#0d6efd; padding:20px; text-align:center;">
              <h1 style="color:#ffffff; margin:0; font-size:26px; letter-spacing:1px;">
                Dsport
              </h1>
              <p style="color:#e9f1ff; margin:5px 0 0; font-size:14px;">
                All Sports. One Store.
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:30px;">
              <h2 style="margin:0 0 10px; color:#333;">
                Login Verification
              </h2>
              <p style="color:#555; font-size:15px; line-height:1.6;">
                We received a request to log in to your <strong>Dsport</strong> account.
                Please use the OTP below to continue.
              </p>

              <!-- OTP Box -->
              <div style="margin:25px 0; text-align:center;">
                <span style="
                  display:inline-block;
                  background:#f1f5ff;
                  color:#0d6efd;
                  font-size:28px;
                  letter-spacing:6px;
                  padding:12px 20px;
                  border-radius:6px;
                  font-weight:bold;
                ">
                  ${otp}
                </span>
              </div>

              <p style="color:#555; font-size:14px;">
                ⏱ This OTP is valid for <strong>2 minutes</strong>.
              </p>

              <p style="color:#999; font-size:13px; margin-top:20px;">
                If you did not request this login, please ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f4f6f8; padding:15px; text-align:center;">
              <p style="margin:0; font-size:12px; color:#888;">
                © ${new Date().getFullYear()} Dsport. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
