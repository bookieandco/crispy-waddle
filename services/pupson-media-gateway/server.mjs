import http from 'node:http';

const port = Number(process.env.PORT || 3000);
const mediaWorkerUrl = process.env.MEDIA_WORKER_INTERNAL_URL?.replace(/\/$/, '');
const token = process.env.PUPSON_MEDIA_GATEWAY_TOKEN?.trim();
const maxBytes = 15 * 1024 * 1024;

if (!mediaWorkerUrl) {
  throw new Error('MEDIA_WORKER_INTERNAL_URL is required.');
}
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

function authorized(req) {
  return (req.headers.authorization || '') === `Bearer ${token}`;
}

async function collectBody(req) {
  const declared = Number(req.headers['content-length'] || 0);
  if (declared > maxBytes) {
    const error = new Error('payload_too_large');
    error.statusCode = 413;
    throw error;
  }

  const chunks = [];
  let received = 0;
  for await (const chunk of req) {
    received += chunk.length;
    if (received > maxBytes) {
      const error = new Error('payload_too_large');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function workerHealth() {
  try {
    const response = await fetch(new URL('/health', mediaWorkerUrl), {
      method: 'GET',
      signal: AbortSignal.timeout(10000),
    });
    const detail = (await response.text()).slice(0, 500);
    return {
      ok: response.ok,
      status: response.status,
      detail,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      detail: error instanceof Error ? error.message.slice(0, 500) : 'worker_probe_failed',
    };
  }
}

async function proxyBackgroundRemoval(req, res, requestUrl) {
  const body = await collectBody(req);
  const target = new URL('/background', mediaWorkerUrl);
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
}

async function proxyUpscale(req, res) {
  const body = await collectBody(req);
  const contentType = req.headers['content-type'];
  if (!contentType?.toLowerCase().startsWith('multipart/form-data')) {
    return json(res, 415, { error: 'multipart_required' });
  }

  const parsedRequest = new Request('http://gateway.local/upscale', {
    method: 'POST',
    headers: { 'content-type': contentType },
    body,
  });
  const form = await parsedRequest.formData();
  const source = form.get('file');
  if (!(source instanceof File)) {
    return json(res, 400, { error: 'missing_file' });
  }

  const scale = Number(form.get('scale') || 4);
  if (scale !== 2 && scale !== 4) {
    return json(res, 400, { error: 'unsupported_scale' });
  }

  const format = String(form.get('format') || 'png').toLowerCase();
  if (!['png', 'jpg', 'jpeg', 'webp'].includes(format)) {
    return json(res, 400, { error: 'unsupported_format' });
  }

  const upstreamForm = new FormData();
  upstreamForm.append(
    'image',
    new Blob([await source.arrayBuffer()], { type: source.type || 'application/octet-stream' }),
    source.name || 'artwork'
  );

  const target = new URL('/upscale', mediaWorkerUrl);
  target.searchParams.set('ext', format === 'jpeg' ? 'jpg' : format);

  const response = await fetch(target, {
    method: 'POST',
    body: upstreamForm,
    signal: AbortSignal.timeout(180000),
  });

  const output = Buffer.from(await response.arrayBuffer());
  res.writeHead(response.status, {
    'content-type': response.headers.get('content-type') || 'application/octet-stream',
    'content-length': String(output.length),
    'cache-control': 'no-store',
    'x-pupson-upscale-provider': 'real-esrgan-x4plus-cpu',
    'x-pupson-requested-scale': String(scale),
  });
  res.end(output);
}

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url || '/', 'http://gateway.local');

    if (requestUrl.pathname === '/live' && req.method === 'GET') {
      return json(res, 200, {
        service: 'pupson-media-gateway',
        status: 'live',
      });
    }

    if (requestUrl.pathname === '/health' && req.method === 'GET') {
      const worker = await workerHealth();
      if (!worker.ok) {
        console.warn(
          `media worker readiness failed: status=${worker.status} detail=${worker.detail}`
        );
      }
      return json(res, worker.ok ? 200 : 503, {
        service: 'pupson-media-gateway',
        status: worker.ok ? 'ok' : 'degraded',
        media_worker: worker.ok ? 'ready' : 'unavailable',
        worker_status: worker.status,
      });
    }

    if (req.method !== 'POST') {
      res.setHeader('allow', 'POST');
      return json(res, 405, { error: 'method_not_allowed' });
    }

    if (!authorized(req)) {
      return json(res, 401, { error: 'unauthorized' });
    }

    if (requestUrl.pathname === '/') {
      return await proxyBackgroundRemoval(req, res, requestUrl);
    }

    if (requestUrl.pathname === '/upscale') {
      return await proxyUpscale(req, res);
    }

    return json(res, 404, { error: 'not_found' });
  } catch (error) {
    const status = Number(error?.statusCode || 502);
    if (!res.headersSent) {
      json(res, status, {
        error: status === 413 ? 'payload_too_large' : 'upstream_failure',
      });
    } else {
      res.end();
    }
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`pupson-media-gateway listening on :${port}`);
  setTimeout(async () => {
    const worker = await workerHealth();
    console.log(
      `media worker startup probe: ok=${worker.ok} status=${worker.status} detail=${worker.detail}`
    );
  }, 1500).unref();
});
