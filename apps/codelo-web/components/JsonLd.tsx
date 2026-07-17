/**
 * Renders a schema.org JSON-LD block. `data` is built from our own data
 * (never user HTML), so the JSON.stringify payload is safe to inline.
 */
export function JsonLd({ data }: { data: object | object[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
