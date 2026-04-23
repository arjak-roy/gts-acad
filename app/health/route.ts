const HEALTH_RESPONSE_BODY = '{"status":"ok"}';

const HEALTH_HEADERS = {
  "Content-Type": "application/json",
  "Content-Length": String(new TextEncoder().encode(HEALTH_RESPONSE_BODY).length),
  "Cache-Control": "no-store",
};

export async function GET() {
  return new Response(HEALTH_RESPONSE_BODY, {
    status: 200,
    headers: HEALTH_HEADERS,
  });
}

export async function HEAD() {
  return new Response(null, {
    status: 200,
    headers: HEALTH_HEADERS,
  });
}
