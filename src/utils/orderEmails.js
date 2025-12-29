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
