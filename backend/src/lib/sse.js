export function openSse(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(': connected\n\n');
}

export function sendSse(res, event, data) {
  try {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  } catch {
    // client already disconnected
  }
}

export function closeSse(res) {
  try {
    res.end();
  } catch {
    // already closed
  }
}

export function startHeartbeat(res, intervalMs = 25000) {
  const timer = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      clearInterval(timer);
    }
  }, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}
