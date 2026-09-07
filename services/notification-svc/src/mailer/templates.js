'use strict';

const APP_NAME = 'WiseBiz';
const APP_URL = process.env.APP_URL || 'https://wisebiz.online';
const BRAND_COLOR = '#6366f1';

function baseLayout(content, previewText = '') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${APP_NAME}</title>
  <!--[if mso]><style>td,th,div,p,a,h1,h2,h3,h4,h5,h6{font-family:"Segoe UI",Arial,sans-serif !important;}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:'Segoe UI',Arial,sans-serif;">
  ${previewText ? `<div style="display:none;max-height:0;overflow:hidden;">${previewText}</div>` : ''}
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:${BRAND_COLOR};padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:-0.5px;">
              🛍 ${APP_NAME}
            </h1>
            <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">wisebiz.online</p>
          </td>
        </tr>
        <!-- Body -->
        <tr><td style="padding:40px;">${content}</td></tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:24px 40px;border-top:1px solid #e5e7eb;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">
              © ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.<br/>
              <a href="${APP_URL}" style="color:${BRAND_COLOR};text-decoration:none;">${APP_URL}</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function orderPlaced(data) {
  const { order_number, user_email, total_amount, currency, items, shipping_address } = data;

  const itemRows = (items || []).map((item) => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;">
        <strong style="color:#111827;">${item.name}</strong>
        ${item.variant ? `<br/><span style="color:#6b7280;font-size:13px;">${item.variant.name}: ${item.variant.value}</span>` : ''}
      </td>
      <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;text-align:center;color:#6b7280;">×${item.quantity}</td>
      <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;text-align:right;color:#111827;font-weight:600;">
        ${currency} ${(item.price * item.quantity).toFixed(2)}
      </td>
    </tr>`).join('');

  const content = `
    <h2 style="margin:0 0 8px;color:#111827;font-size:22px;">Order Confirmed! 🎉</h2>
    <p style="color:#6b7280;margin:0 0 28px;">Hi there, your order has been placed successfully.</p>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;margin-bottom:28px;">
      <p style="margin:0;font-size:14px;color:#166534;">
        <strong>Order Number:</strong>
        <span style="font-family:monospace;font-size:16px;color:#15803d;margin-left:8px;">${order_number}</span>
      </p>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <thead>
        <tr>
          <th style="text-align:left;color:#6b7280;font-size:12px;text-transform:uppercase;padding-bottom:8px;">Item</th>
          <th style="text-align:center;color:#6b7280;font-size:12px;text-transform:uppercase;padding-bottom:8px;">Qty</th>
          <th style="text-align:right;color:#6b7280;font-size:12px;text-transform:uppercase;padding-bottom:8px;">Price</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
      <tfoot>
        <tr>
          <td colspan="2" style="padding-top:16px;font-weight:700;color:#111827;font-size:16px;">Total</td>
          <td style="padding-top:16px;text-align:right;font-weight:700;color:#6366f1;font-size:18px;">
            ${currency} ${parseFloat(total_amount).toFixed(2)}
          </td>
        </tr>
      </tfoot>
    </table>

    <div style="background:#f9fafb;border-radius:8px;padding:16px 20px;margin-bottom:28px;">
      <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#374151;">Shipping To</p>
      <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">
        ${shipping_address?.full_name || ''}<br/>
        ${shipping_address?.line1 || ''}${shipping_address?.line2 ? ', ' + shipping_address.line2 : ''}<br/>
        ${shipping_address?.city || ''}, ${shipping_address?.state || ''} ${shipping_address?.postal_code || ''}<br/>
        ${shipping_address?.country || 'India'}
      </p>
    </div>

    <div style="text-align:center;">
      <a href="${APP_URL}/orders/${order_number}"
         style="display:inline-block;background:#6366f1;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
        Track Your Order →
      </a>
    </div>`;

  return {
    subject: `Order Confirmed — ${order_number} | ${APP_NAME}`,
    html: baseLayout(content, `Your order ${order_number} has been confirmed!`),
  };
}

function orderShipped(data) {
  const { order_number, user_email } = data;

  const content = `
    <h2 style="margin:0 0 8px;color:#111827;font-size:22px;">Your Order Is On Its Way! 🚚</h2>
    <p style="color:#6b7280;margin:0 0 28px;">Great news — your order <strong>${order_number}</strong> has been shipped.</p>

    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:20px;margin-bottom:28px;text-align:center;">
      <p style="margin:0;font-size:32px;">📦</p>
      <p style="margin:8px 0 0;color:#1d4ed8;font-weight:600;">Estimated Delivery: 3–5 Business Days</p>
    </div>

    <div style="text-align:center;">
      <a href="${APP_URL}/orders/${order_number}"
         style="display:inline-block;background:#6366f1;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
        Track Shipment →
      </a>
    </div>`;

  return {
    subject: `Shipped! Your order ${order_number} is on the way — ${APP_NAME}`,
    html: baseLayout(content, `Order ${order_number} has been shipped!`),
  };
}

function orderDelivered(data) {
  const { order_number } = data;

  const content = `
    <h2 style="margin:0 0 8px;color:#111827;font-size:22px;">Delivered! Hope You Love It 💚</h2>
    <p style="color:#6b7280;margin:0 0 28px;">Your order <strong>${order_number}</strong> has been delivered.</p>

    <div style="background:#f0fdf4;border-radius:8px;padding:20px;margin-bottom:28px;text-align:center;">
      <p style="margin:0;font-size:40px;">✅</p>
      <p style="margin:8px 0 0;color:#166534;font-weight:600;">Order Successfully Delivered</p>
    </div>

    <p style="color:#6b7280;text-align:center;margin-bottom:28px;">
      Enjoyed your purchase? Leave a review and help other shoppers!
    </p>

    <div style="text-align:center;">
      <a href="${APP_URL}/orders/${order_number}"
         style="display:inline-block;background:#6366f1;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
        Write a Review →
      </a>
    </div>`;

  return {
    subject: `Delivered — ${order_number} | ${APP_NAME}`,
    html: baseLayout(content, `Your order ${order_number} has been delivered!`),
  };
}

function orderCancelled(data) {
  const { order_number } = data;

  const content = `
    <h2 style="margin:0 0 8px;color:#111827;font-size:22px;">Order Cancelled</h2>
    <p style="color:#6b7280;margin:0 0 28px;">Your order <strong>${order_number}</strong> has been cancelled as requested.</p>

    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px 20px;margin-bottom:28px;">
      <p style="margin:0;color:#991b1b;font-size:14px;">
        If you paid for this order, a refund will be processed within 5–7 business days.
      </p>
    </div>

    <div style="text-align:center;">
      <a href="${APP_URL}/products"
         style="display:inline-block;background:#6366f1;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
        Continue Shopping →
      </a>
    </div>`;

  return {
    subject: `Order Cancelled — ${order_number} | ${APP_NAME}`,
    html: baseLayout(content, `Order ${order_number} has been cancelled.`),
  };
}

function welcomeEmail(data) {
  const { first_name, email } = data;

  const content = `
    <h2 style="margin:0 0 8px;color:#111827;font-size:22px;">Welcome to WiseBiz, ${first_name}! 🎉</h2>
    <p style="color:#6b7280;margin:0 0 28px;">
      Your account has been created successfully. You're all set to start shopping!
    </p>

    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:12px;padding:28px;margin-bottom:28px;text-align:center;color:#ffffff;">
      <p style="margin:0 0 8px;font-size:32px;">🛍️</p>
      <h3 style="margin:0 0 8px;font-size:20px;font-weight:700;">Discover Thousands of Products</h3>
      <p style="margin:0;opacity:0.85;font-size:14px;">Electronics, Fashion, Home & Living and more — all in one place.</p>
    </div>

    <div style="text-align:center;">
      <a href="${APP_URL}/products"
         style="display:inline-block;background:#6366f1;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
        Start Shopping →
      </a>
    </div>`;

  return {
    subject: `Welcome to ${APP_NAME}, ${first_name}!`,
    html: baseLayout(content, `Welcome aboard, ${first_name}!`),
  };
}

function passwordReset(data) {
  const { email, reset_url } = data;

  const content = `
    <h2 style="margin:0 0 8px;color:#111827;font-size:22px;">Password Reset Request 🔑</h2>
    <p style="color:#6b7280;margin:0 0 28px;">We received a request to reset your WiseBiz password. Click the button below within <strong>1 hour</strong> to proceed.</p>

    <div style="text-align:center;margin-bottom:28px;">
      <a href="${reset_url}"
         style="display:inline-block;background:#6366f1;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
        Reset My Password →
      </a>
    </div>

    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:14px 18px;">
      <p style="margin:0;color:#991b1b;font-size:13px;">
        ⚠️ If you didn't request this, you can safely ignore this email. Your password will not change.
      </p>
    </div>`;

  return {
    subject: `Reset your ${APP_NAME} password`,
    html: baseLayout(content, 'Reset your WiseBiz password'),
  };
}

module.exports = { orderPlaced, orderShipped, orderDelivered, orderCancelled, welcomeEmail, passwordReset };
