export const invoiceEmailTemplate = ({
  username,
  orderId,
  orderDate,
  totalAmount,
}) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Dsport Invoice</title>
</head>

<body style="margin:0; padding:0; background-color:#f4f6f8; font-family:Arial, Helvetica, sans-serif;">
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Dsport Invoice</title>
</head>

<body style="margin:0; padding:0; background-color:#f4f6f8; font-family:Arial, Helvetica, sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:40px 0;">

        <table width="100%" max-width="600" style="background:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.08);">

          <!-- HEADER -->
          <tr>
            <td style="background:#0d6efd; padding:20px; text-align:center;">
              <h1 style="color:#ffffff; margin:0; font-size:26px;">
                Dsport
              </h1>
              <p style="color:#e9f1ff; margin:5px 0 0; font-size:14px;">
                All Sports. One Store.
              </p>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="padding:30px; color:#333;">
              <p style="font-size:15px;">
                Hello,
              </p>

              <p style="font-size:15px; line-height:1.6;">
                Thank you for shopping with <strong>Dsport</strong> 🎉  
                Your order has been successfully placed.
              </p>

              <!-- ORDER DETAILS -->
              <table width="100%" cellpadding="8" cellspacing="0" style="margin:20px 0; background:#f8f9fa; border-radius:6px;">
                <tr>
                  <td><strong>Order ID:</strong></td>
                  <td>${orderId}</td>
                </tr>
                <tr>
                  <td><strong>Order Date:</strong></td>
                  <td>${orderDate}</td>
                </tr>
                <tr>
                  <td><strong>Total Amount:</strong></td>
                  <td><strong>₹${totalAmount}</strong></td>
                </tr>
              </table>

              <p style="font-size:14px;">
                📎 Your invoice PDF is attached with this email.  
                Please keep it for your records.
              </p>

              <p style="font-size:14px;">
                If you have any questions or need help, feel free to contact our support team.
              </p>

              <p style="margin-top:25px;">
                Happy Shopping 🏏⚽🏀<br/>
                <strong>Team Dsport</strong>
              </p>
            </td>
          </tr>

          <!-- FOOTER -->
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
const baseEmailTemplate = ({ title, content }) => `
  <div style="background:#f4f6f8;padding:24px;font-family:Arial,Helvetica,sans-serif">
    <div style="
      max-width:600px;
      margin:0 auto;
      background:#ffffff;
      border-radius:8px;
      overflow:hidden;
      box-shadow:0 2px 8px rgba(0,0,0,0.08)
    ">
      
      <!-- HEADER -->
      <div style="background:#0d6efd;color:#ffffff;padding:16px 24px">
        <h1 style="margin:0;font-size:20px;">Dsport</h1>
        <p style="margin:4px 0 0;font-size:12px;opacity:0.9">
          All Sports. One Store.
        </p>
      </div>

      <!-- BODY -->
      <div style="padding:24px;color:#333">
        <h2 style="margin-top:0">${title}</h2>
        ${content}
      </div>

      <!-- FOOTER -->
      <div style="
        padding:16px;
        font-size:12px;
        text-align:center;
        color:#777;
        background:#fafafa
      ">
        © ${new Date().getFullYear()} Dsport. All rights reserved.
      </div>

    </div>
  </div>
`;


export const paymentStatusEmail = (order) =>
  baseEmailTemplate({
    title: "Payment Status Updated",
    content: `
      <p>Hello,</p>

      <p>
        Your payment for order 
        <strong>#${order._id}</strong> has been updated.
      </p>

      <div style="
        margin:16px 0;
        padding:16px;
        background:#f1f7ff;
        border-left:4px solid #0d6efd
      ">
        <p style="margin:0">
          <strong>Status:</strong> ${order.paymentStatus}
        </p>
        <p style="margin:8px 0 0">
          <strong>Total Amount:</strong> ₹${order.totalPayableAmount.toLocaleString("en-IN")}
        </p>
      </div>

      <p>
        If you have any questions, feel free to contact our support team.
      </p>

      <p>Thank you for shopping with Dsport!</p>
    `,
  });

export const deliveryStatusEmail = (order) =>
  baseEmailTemplate({
    title: "Delivery Status Update",
    content: `
      <p>Hello,</p>

      <p>
        The delivery status of your order 
        <strong>#${order._id}</strong> has been updated.
      </p>

      <div style="
        margin:16px 0;
        padding:16px;
        background:#f8f9fa;
        border-left:4px solid #198754
      ">
        <p style="margin:0">
          <strong>Current Status:</strong> ${order.deliveryStatus}
        </p>
      </div>

      ${
        order.deliveryStatus === "Delivered"
          ? `
            <div style="
              margin-top:16px;
              padding:16px;
              background:#e9f7ef;
              border-radius:6px
            ">
              <p style="margin:0">
                🎉 <strong>Your order has been delivered successfully!</strong>
              </p>
              <p style="margin:8px 0 0">
                We hope you enjoy your purchase.
              </p>
            </div>
          `
          : ""
      }

      <p style="margin-top:24px">
        Thank you for choosing Dsport.
      </p>
    `,
  });

export const orderCancelledEmail = (order) =>
  baseEmailTemplate({
    title: "Order Cancelled",
    content: `
      <p>Hello,</p>

      <p>
        Your order <strong>#${order._id}</strong> has been successfully cancelled.
      </p>

      <div style="
        margin:16px 0;
        padding:16px;
        background:#fff3cd;
        border-left:4px solid #ffc107
      ">
        ${
          order.paymentStatus === "Refunded"
            ? `<p style="margin:0">
                💰 Your refund has been initiated and will be processed shortly.
              </p>`
            : `<p style="margin:0">
                No payment was charged for this order.
              </p>`
        }
      </div>

      <p>
        If you need help or have any concerns, our support team is always here.
      </p>

      <p>Regards,<br /><strong>Team Dsport</strong></p>
    `,
  });

