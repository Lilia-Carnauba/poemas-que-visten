# Poemas que Visten

La camiseta es el producto físico. El poema es el producto emocional.

## Stack
Netlify + Netlify Functions · Supabase · Stripe · Gelato · Brevo (fase posterior)

## Estructura
```
src/                  → frontend estático (HTML/CSS/JS vanilla)
netlify/functions/    → backend serverless (Stripe, Gelato, Supabase)
supabase/schema.sql   → esquema completo de base de datos
.env.example          → variables de entorno necesarias
```

## Puesta en marcha
1. `npm install`
2. Copia `.env.example` a `.env` y rellena con tus claves (Supabase, Stripe test, Gelato)
3. En Supabase: SQL Editor → pega el contenido de `supabase/schema.sql` → Run
4. `npx netlify dev` para levantar el sitio + functions en local

## Estados que requieren aprobación manual (no automatizar)
- `postulaciones` de nuevos autores: nace `pendiente`, solo un humano la pasa a `aprobada`
- Publicación del artículo/producto derivado de una postulación aprobada: se crea a mano, no automáticamente

## Notas de seguridad
- La `service_role key` de Supabase y las claves secretas de Stripe/Gelato viven solo en Netlify Functions, nunca en `src/`
- `/mi-poema/*` lleva `X-Robots-Tag: noindex` (ver `netlify.toml`)
