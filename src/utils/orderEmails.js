export const invoiceEmailTemplate = ({
  userName,
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
                Hi <strong>${userName}</strong>,
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
                  <td><strong>₹${totalAmount.toLocaleString("en-IN")}</strong></td>
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

export const paymentStatusEmail = (order) => `
  <h2>Payment Status Updated</h2>
  <p>Your payment for order <b>${order._id}</b> is now <b>${order.paymentStatus}</b>.</p>
  <p>Total Amount: ₹${order.totalPayableAmount.toLocaleString("en-IN")}</p>
`;

export const deliveryStatusEmail = (order) => `
  <h2>Delivery Status Updated</h2>
  <p>Your order <b>${order._id}</b> is now <b>${order.deliveryStatus}</b>.</p>
  ${
    order.deliveryStatus === "Delivered"
      ? "<p>🎉 Your order has been delivered successfully.</p>"
      : ""
  }
`;
export const orderCancelledEmail = (order) => {
  return `
    <div style="font-family: Arial, sans-serif">
      <h2>Order Cancelled</h2>
      <p>Your order <b>#${order._id}</b> has been successfully cancelled.</p>

      ${
        order.paymentStatus === "Refunded"
          ? "<p>Your refund will be processed shortly.</p>"
          : "<p>No payment was charged for this order.</p>"
      }

      <p>Thank you for shopping with us.</p>
    </div>
  `;
};
