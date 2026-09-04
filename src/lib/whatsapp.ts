/**
 * Send WhatsApp notification for new order
 * This uses the lowest-cost approach: generates WhatsApp click-to-chat URLs
 * that can be used to send notifications without requiring paid API access
 */

export interface OrderNotificationData {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  items: Array<{
    name: string;
    qty: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: string;
  address?: string;
  area?: string;
  city?: string;
  notes?: string;
}

/**
 * Generate WhatsApp message for business notification
 */
export function generateBusinessWhatsAppMessage(
  data: OrderNotificationData,
  lang: string = "en",
): string {
  const isAr = lang === "ar";

  let message = "";

  if (isAr) {
    message = `🛒 *طلب جديد*\n\n`;
    message += `رقم الطلب: ${data.orderNumber}\n`;
    message += `العميل: ${data.customerName}\n`;
    message += `الهاتف: ${data.customerPhone}\n`;

    if (data.address) {
      message += `العنوان: ${data.address}`;
      if (data.area) message += `, ${data.area}`;
      if (data.city) message += `, ${data.city}`;
      message += `\n`;
    }

    message += `\nالمنتجات:\n`;
    data.items.forEach((item, index) => {
      message += `${index + 1}. ${item.name} × ${item.qty} = ${item.lineTotal} SSP\n`;
    });

    message += `\nالمجموع الفرعي: ${data.subtotal} SSP\n`;
    message += `التوصيل: ${data.deliveryFee} SSP\n`;
    message += `*الإجمالي: ${data.total} SSP*\n`;
    message += `طريقة الدفع: ${data.paymentMethod === "pickup" ? "استلام من المتجر" : "الدفع عند الاستلام"}\n`;

    if (data.notes) {
      message += `\nملاحظات: ${data.notes}\n`;
    }
  } else {
    message = `🛒 *New Order*\n\n`;
    message += `Order Number: ${data.orderNumber}\n`;
    message += `Customer: ${data.customerName}\n`;
    message += `Phone: ${data.customerPhone}\n`;

    if (data.address) {
      message += `Address: ${data.address}`;
      if (data.area) message += `, ${data.area}`;
      if (data.city) message += `, ${data.city}`;
      message += `\n`;
    }

    message += `\nProducts:\n`;
    data.items.forEach((item, index) => {
      message += `${index + 1}. ${item.name} × ${item.qty} = ${item.lineTotal} SSP\n`;
    });

    message += `\nSubtotal: ${data.subtotal} SSP\n`;
    message += `Delivery: ${data.deliveryFee} SSP\n`;
    message += `*Total: ${data.total} SSP*\n`;
    message += `Payment: ${data.paymentMethod === "pickup" ? "Store pickup" : "Cash on delivery"}\n`;

    if (data.notes) {
      message += `\nNotes: ${data.notes}\n`;
    }
  }

  return message;
}

/**
 * Generate WhatsApp URL for business notification
 * This can be used to open WhatsApp with pre-filled message
 */
export function generateBusinessWhatsAppUrl(phoneNumber: string, message: string): string {
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${phoneNumber.replace(/\D/g, "")}?text=${encodedMessage}`;
}

/**
 * Send order notification via WhatsApp (client-side redirect)
 * This is called after successful order placement
 */
export function sendOrderNotificationWhatsApp(
  data: OrderNotificationData,
  phoneNumber: string,
  lang: string = "en",
): string {
  const message = generateBusinessWhatsAppMessage(data, lang);
  return generateBusinessWhatsAppUrl(phoneNumber, message);
}

/**
 * Input shape for generateAdminOrderCopyMessage — the subset of the admin Order view
 * needed to produce a WhatsApp-ready message.
 */
export interface AdminOrderCopyInput {
  order_number: string;
  customer_name: string;
  phone: string;
  phone2?: string | null;
  address?: string | null;
  area?: string | null;
  city?: string | null;
  notes?: string | null;
  payment_method: string;
  subtotal: number;
  delivery_fee: number;
  total: number;
  pickup_deadline_at?: string | null;
  order_items?: Array<{
    name_en: string;
    name_ar?: string | null;
    qty: number;
    unit_price: number;
    line_total: number;
  }>;
}

/**
 * Generate a WhatsApp-ready order message from the admin's order view.
 * Reuses the same formatting pattern as generateBusinessWhatsAppMessage but
 * sources fields from the Admin Order structure and applies bilingual names.
 */
export function generateAdminOrderCopyMessage(
  order: AdminOrderCopyInput,
  lang: "en" | "ar" = "en",
): string {
  const isAr = lang === "ar";
  const items = (order.order_items ?? []).map((it) => {
    const name = isAr && it.name_ar ? it.name_ar : it.name_en || it.name_en;
    return {
      name,
      qty: Number(it.qty ?? 0),
      unitPrice: Number(it.unit_price ?? 0),
      lineTotal: Number(it.line_total ?? 0),
    };
  });

  const deadlineLabel = (() => {
    if (order.payment_method !== "pickup" || !order.pickup_deadline_at) return null;
    const ms = new Date(order.pickup_deadline_at).getTime() - Date.now();
    if (ms <= 0) return isAr ? "انتهت فترة الاستلام" : "Pickup period expired";
    const totalHours = Math.floor(ms / (1000 * 60 * 60));
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    if (days > 0) {
      return isAr
        ? `فترة الاستلام: ${days} ${days === 1 ? "يوم" : "أيام"} و${hours} ساعة متبقية`
        : `Pickup deadline: ${days} day${days === 1 ? "" : "s"} ${hours}h remaining`;
    }
    return isAr
      ? `فترة الاستلام: ${hours} ساعات متبقية`
      : `Pickup deadline: ${hours} hour${hours === 1 ? "" : "s"} remaining`;
  })();

  return generateBusinessWhatsAppMessage(
    {
      orderNumber: order.order_number,
      customerName: order.customer_name,
      customerPhone: order.phone + (order.phone2 ? ` · ${order.phone2}` : ""),
      items,
      subtotal: Number(order.subtotal ?? 0),
      deliveryFee: Number(order.delivery_fee ?? 0),
      total: Number(order.total ?? 0),
      paymentMethod: order.payment_method as "cod" | "pickup",
      address: order.address ?? undefined,
      area: order.area ?? undefined,
      city: order.city ?? undefined,
      notes: deadlineLabel
        ? `${deadlineLabel}${order.notes ? ` | ${order.notes}` : ""}`
        : order.notes ?? undefined,
    },
    lang,
  );
}
