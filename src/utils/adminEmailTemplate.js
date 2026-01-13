export const sendCredentialsTemplate = ({
  fullname,
  username,
  email,
  password,
  role,
}) => `
<div style="font-family: Arial, Helvetica, sans-serif; background-color: #f4f6f8; padding: 30px;">
  <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background-color: #0d6efd; padding: 20px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0;">Dsport Admin Panel</h1>
      <p style="color: #e9ecef; margin: 5px 0 0;">All Sports. One Store.</p>
    </div>

    <!-- Body -->
    <div style="padding: 25px; color: #333;">
      <h2 style="margin-top: 0;">Welcome, ${fullname} 👋</h2>

      <p>
        Your <b>Admin account</b> has been successfully created for the
        <b>Dsport Admin Panel</b>. Below are your login credentials:
      </p>

      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <p style="margin: 6px 0;"><b>Username:</b> ${username}</p>
        <p style="margin: 6px 0;"><b>Email:</b> ${email}</p>
        <p style="margin: 6px 0;"><b>Password:</b> ${password}</p>
        <p style="margin: 6px 0;"><b>Role:</b> ${role}</p>
      </div>

      <p>You can access the admin dashboard using the link below:</p>

      <div style="text-align: center; margin: 25px 0;">
        <a
          href="https://dsport-adminpanel.vercel.app"
          target="_blank"
          style="
            background-color: #0d6efd;
            color: #ffffff;
            padding: 12px 22px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: bold;
            display: inline-block;
          "
        >
          Go to Admin Panel
        </a>
      </div>

      <p style="color: #dc3545;">
        ⚠️ For security reasons, please log in and <b>change your password immediately</b>.
      </p>

      <p>If you face any issues accessing your account, please contact the super admin.</p>

      <p style="margin-top: 30px;">
        Regards,<br />
        <b>Dsport Team</b>
      </p>
    </div>

    <!-- Footer -->
    <div style="background-color: #f1f3f5; text-align: center; padding: 15px; font-size: 12px; color: #6c757d;">
      © ${new Date().getFullYear()} Dsport. All rights reserved.<br />
      This is a system-generated email. Please do not reply.
    </div>

  </div>
</div>
`;

export const forgotPasswordOtpTemplate = ({
  fullname,
  otp,
  expiryMinutes = 10,
}) => `
<div style="font-family: Arial, Helvetica, sans-serif; background-color: #f4f6f8; padding: 30px;">
  <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background-color: #0d6efd; padding: 20px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0;">Dsport Admin Panel</h1>
      <p style="color: #e9ecef; margin: 5px 0 0;">Password Recovery</p>
    </div>

    <!-- Body -->
    <div style="padding: 25px; color: #333;">
      <h2 style="margin-top: 0;">Hello ${fullname || "Admin"},</h2>

      <p>
        We received a request to reset your <b>Dsport Admin Panel</b> password.
        Please use the OTP below to proceed:
      </p>

      <div style="text-align: center; margin: 30px 0;">
        <div
          style="
            display: inline-block;
            background-color: #f8f9fa;
            border: 1px dashed #0d6efd;
            padding: 15px 30px;
            font-size: 26px;
            letter-spacing: 6px;
            font-weight: bold;
            color: #0d6efd;
            border-radius: 6px;
          "
        >
          ${otp}
        </div>
      </div>

      <p style="text-align: center;">
        This OTP will expire in <b>${expiryMinutes} minutes</b>.
      </p>

      <p style="color: #dc3545; margin-top: 20px;">
        ⚠️ If you did not request a password reset, please ignore this email.
        Do not share this OTP with anyone.
      </p>

      <p style="margin-top: 30px;">
        Regards,<br />
        <b>Dsport Team</b>
      </p>
    </div>

    <!-- Footer -->
    <div style="background-color: #f1f3f5; text-align: center; padding: 15px; font-size: 12px; color: #6c757d;">
      © ${new Date().getFullYear()} Dsport. All rights reserved.<br />
      This is a system-generated email. Please do not reply.
    </div>

  </div>
</div>
`;
export const profileUpdatedTemplate = ({ fullname }) => `
<div style="font-family: Arial, Helvetica, sans-serif; background-color: #f4f6f8; padding: 30px;">
  <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.08);">

    <div style="background-color: #0d6efd; padding: 20px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0;">Dsport Admin Panel</h1>
      <p style="color: #e9ecef; margin: 5px 0 0;">Profile Update</p>
    </div>

    <div style="padding: 25px; color: #333;">
      <h2>Profile Updated Successfully ✅</h2>

      <p>Your admin profile has been updated successfully.</p>

      ${
        fullname
          ? `<p><b>Updated Name:</b> ${fullname}</p>`
          : ""
      }

      <p>If you did not make this change, please contact the Super Admin immediately.</p>

      <p style="margin-top: 30px;">
        Regards,<br />
        <b>Dsport Team</b>
      </p>
    </div>

    <div style="background-color: #f1f3f5; text-align: center; padding: 15px; font-size: 12px; color: #6c757d;">
      © ${new Date().getFullYear()} Dsport. All rights reserved.
    </div>

  </div>
</div>
`;
export const adminRoleUpdatedTemplate = ({ role }) => `
<div style="font-family: Arial, Helvetica, sans-serif; background-color: #f4f6f8; padding: 30px;">
  <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.08);">

    <div style="background-color: #0d6efd; padding: 20px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0;">Dsport Admin Panel</h1>
      <p style="color: #e9ecef; margin: 5px 0 0;">Role Update</p>
    </div>

    <div style="padding: 25px; color: #333;">
      <h2>Admin Role Updated 🔔</h2>

      <p>Your admin role has been updated by the Super Admin.</p>

      <div style="background-color: #f8f9fa; padding: 12px; border-radius: 6px; margin: 20px 0;">
        <p style="margin: 0;"><b>New Role:</b> ${role}</p>
      </div>

      <p>Please log in again if required to access updated permissions.</p>

      <p style="margin-top: 30px;">
        Regards,<br />
        <b>Dsport Team</b>
      </p>
    </div>

    <div style="background-color: #f1f3f5; text-align: center; padding: 15px; font-size: 12px; color: #6c757d;">
      © ${new Date().getFullYear()} Dsport. All rights reserved.
    </div>

  </div>
</div>
`;
export const adminAccountDeletedTemplate = () => `
<div style="font-family: Arial, Helvetica, sans-serif; background-color: #f4f6f8; padding: 30px;">
  <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.08);">

    <div style="background-color: #dc3545; padding: 20px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0;">Dsport Admin Panel</h1>
      <p style="color: #f8d7da; margin: 5px 0 0;">Account Removal</p>
    </div>

    <div style="padding: 25px; color: #333;">
      <h2>Admin Account Removed ❌</h2>

      <p>Your admin account has been removed from the Dsport system.</p>

      <p>
        If you believe this action was taken by mistake,
        please contact the Super Admin immediately.
      </p>

      <p style="margin-top: 30px;">
        Regards,<br />
        <b>Dsport Team</b>
      </p>
    </div>

    <div style="background-color: #f1f3f5; text-align: center; padding: 15px; font-size: 12px; color: #6c757d;">
      © ${new Date().getFullYear()} Dsport. All rights reserved.
    </div>

  </div>
</div>
`;
