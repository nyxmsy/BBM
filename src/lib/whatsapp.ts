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
export function generateBusinessWhatsAppMessage(data: OrderNotificationData, lang: string = "en"): string {
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
export function sendOrderNotificationWhatsApp(data: OrderNotificationData, phoneNumber: string, lang: string = "en"): string {
  const message = generateBusinessWhatsAppMessage(data, lang);
  return generateBusinessWhatsAppUrl(phoneNumber, message);
}
