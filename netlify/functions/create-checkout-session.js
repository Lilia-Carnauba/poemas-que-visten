// netlify/functions/create-checkout-session.js
//
// Recibe el carrito desde el frontend y crea una Stripe Checkout Session.
// El precio NUNCA se confía al cliente: se recalcula aquí contra Supabase.
// El pedido en Supabase todavía no existe — solo se crea cuando el
// webhook de Stripe confirma el pago (ver stripe-webhook.js).

const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SITE_URL = process.env.URL || "http://localhost:8888";

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: "JSON inválido" };
  }

  const { items, cliente, narracion_audio_url } = payload;

  if (!Array.isArray(items) || items.length === 0) {
    return { statusCode: 400, body: "El carrito está vacío" };
  }
  if (!cliente || !cliente.email) {
    return { statusCode: 400, body: "Falta el email del cliente" };
  }

  // 1. Recalcular precios reales desde Supabase — nunca confiar en el cliente.
  const productoIds = items.map((i) => i.producto_id);
  const { data: productos, error } = await supabase
    .from("productos")
    .select("id, nombre, precio, activo, tallas, colores")
    .in("id", productoIds);

  if (error) {
    return { statusCode: 500, body: "Error consultando productos" };
  }

  const lineItems = [];
  for (const item of items) {
    const producto = productos.find((p) => p.id === item.producto_id);

    if (!producto || !producto.activo) {
      return {
        statusCode: 400,
        body: `Producto no disponible: ${item.producto_id}`,
      };
    }
    if (!producto.tallas.includes(item.talla)) {
      return { statusCode: 400, body: `Talla no válida para ${producto.nombre}` };
    }
    if (!producto.colores.includes(item.color)) {
      return { statusCode: 400, body: `Color no válido para ${producto.nombre}` };
    }

    const cantidad = Math.max(1, Math.min(10, Number(item.cantidad) || 1));

    lineItems.push({
      quantity: cantidad,
      price_data: {
        currency: "eur",
        unit_amount: Math.round(producto.precio * 100),
        product_data: {
          name: `${producto.nombre} — ${item.talla}/${item.color}`,
        },
      },
      // guardamos referencia para reconstruir pedido_items en el webhook
      _meta: {
        producto_id: producto.id,
        talla: item.talla,
        color: item.color,
        cantidad,
        precio_unitario: producto.precio,
      },
    });
  }

  // Stripe no acepta metadata anidada por line item, así que serializamos
  // el detalle del carrito completo en la metadata de la sesión.
  // Límite práctico: ~500 chars por campo de metadata en Stripe, suficiente
  // para el volumen esperado en el MVP (carritos de pocas prendas).
  const carritoSerializado = JSON.stringify(lineItems.map((li) => li._meta));

  if (carritoSerializado.length > 480) {
    return {
      statusCode: 400,
      body: "El carrito tiene demasiados artículos distintos. Divide el pedido en dos compras.",
    };
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: cliente.email,
    line_items: lineItems.map(({ _meta, ...li }) => li),
    success_url: `${SITE_URL}/gracias?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${SITE_URL}/carrito`,
    metadata: {
      nombre: cliente.nombre || "",
      telefono: cliente.telefono || "",
      newsletter: cliente.newsletter ? "true" : "false",
      narracion_audio_url: narracion_audio_url || "",
      carrito: carritoSerializado,
    },
  });

  return {
    statusCode: 200,
    body: JSON.stringify({ url: session.url }),
  };
};
