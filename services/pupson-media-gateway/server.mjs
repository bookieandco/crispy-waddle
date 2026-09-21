import http from 'node:http';

const port = Number(process.env.PORT || 3000);
const upstream = process.env.BACKGROUND_REMOVER_INTERNAL_URL?.replace(/\/$/, '');
const token = process.env.PUPSON_MEDIA_GATEWAY_TOKEN?.trim();
const maxBytes = 15 * 1024 * 1024;

if (!upstream) throw new Error('BACKGROUND_REMOVER_INTERNAL_URL is required.');
if (!token || token.length < 32) {
  throw new Error('PUPSON_MEDIA_GATEWAY_TOKEN must be at least 32 characters.');
}

function json(res, status, body) {
  const payload = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': String(payload.length),
    'cache-control': 'no-store',
  });
  res.end(payload);
}

async function upstreamReachable() {
  try {
    const response = await fetch(upstream, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    // The raw server returns 400 when GET lacks ?url=. That still proves the
    // private service is reachable and serving the expected Flask route.
    return response.status === 400 || response.ok;
  } catch {
    return false;
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url || '/', 'http://gateway.local');

    if (requestUrl.pathname === '/health' && req.method === 'GET') {
      const reachable = await upstreamReachable();
      return json(res, reachable ? 200 : 503, {
        service: 'pupson-media-gateway',
        status: reachable ? 'ok' : 'degraded',
        upstream: reachable ? 'reachable' : 'unreachable',
      });
    }

    if (requestUrl.pathname !== '/' || req.method !== 'POST') {
      res.setHeader('allow', 'POST');
      return json(res, 405, { error: 'method_not_allowed' });
    }

    const authorization = req.headers.authorization || '';
    if (authorization !== `Bearer ${token}`) {
      return json(res, 401, { error: 'unauthorized' });
    }

    const declared = Number(req.headers['content-length'] || 0);
    if (declared > maxBytes) {
      return json(res, 413, { error: 'payload_too_large' });
    }

    const chunks = [];
    let received = 0;
    for await (const chunk of req) {
      received += chunk.length;
      if (received > maxBytes) {
        return json(res, 413, { error: 'payload_too_large' });
      }
      chunks.push(chunk);
    }

    const body = Buffer.concat(chunks);
    const target = new URL(upstream);
    target.search = requestUrl.search;

    const headers = {};
    const contentType = req.headers['content-type'];
    if (contentType) headers['content-type'] = contentType;

    const response = await fetch(target, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(120000),
    });

    const output = Buffer.from(await response.arrayBuffer());
    res.writeHead(response.status, {
      'content-type': response.headers.get('content-type') || 'application/octet-stream',
      'content-length': String(output.length),
      'cache-control': 'no-store',
    });
    res.end(output);
  } catch {
    if (!res.headersSent) {
      json(res, 502, { error: 'upstream_failure' });
    } else {
      res.end();
    }
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`pupson-media-gateway listening on :${port}`);
});
