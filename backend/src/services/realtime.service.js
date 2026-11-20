/**
 * Real-time Server-Sent Events (SSE) Push Service
 * Automatically pushes new and updated orders to web clients in real time
 */
export class RealtimeService {
  // Map of userId -> Set of Response objects
  static subscribers = new Map();

  /**
   * Register a new SSE subscriber client for a specific user
   * @param {string|number} userId 
   * @param {import('express').Request} req 
   * @param {import('express').Response} res 
   */
  static addSubscriber(userId, req, res) {
    const uid = String(userId);

    // Set standard SSE response headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable proxy buffering in Nginx
    });

    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    if (!this.subscribers.has(uid)) {
      this.subscribers.set(uid, new Set());
    }
    const clientSet = this.subscribers.get(uid);
    clientSet.add(res);

    // 1. Send immediate handshake connected event
    const handshake = {
      type: 'connected',
      userId: uid,
      timestamp: Date.now(),
      activeConnections: clientSet.size,
    };
    res.write(`event: connected\ndata: ${JSON.stringify(handshake)}\n\n`);

    // 2. Setup periodic keep-alive ping to prevent proxy/browser timeout (every 20s)
    const keepAliveTimer = setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch (err) {
        clearInterval(keepAliveTimer);
      }
    }, 20000);

    // 3. Cleanup on client disconnect
    const cleanup = () => {
      clearInterval(keepAliveTimer);
      const set = this.subscribers.get(uid);
      if (set) {
        set.delete(res);
        if (set.size === 0) {
          this.subscribers.delete(uid);
        }
      }
    };

    req.on('close', cleanup);
    res.on('close', cleanup);
    res.on('finish', cleanup);
  }

  /**
   * Broadcast real-time trade event to all active client windows of the user
   * @param {string|number} userId 
   * @param {object} payload 
   */
  static broadcastTradeUpdate(userId, payload = {}) {
    const uid = String(userId);
    const clientSet = this.subscribers.get(uid);

    if (!clientSet || clientSet.size === 0) {
      return 0; // No active subscribers
    }

    const messageData = {
      event: 'trades:updated',
      timestamp: Date.now(),
      ...payload,
    };

    const sseMessage = `event: trades:updated\ndata: ${JSON.stringify(messageData)}\n\n`;

    let sentCount = 0;
    for (const res of clientSet) {
      try {
        res.write(sseMessage);
        if (typeof res.flush === 'function') {
          res.flush();
        }
        sentCount++;
      } catch (err) {
        // Stale connection, will be cleaned up
        clientSet.delete(res);
      }
    }

    return sentCount;
  }

  /**
   * Get active subscribers count for a user
   */
  static getActiveCount(userId) {
    const uid = String(userId);
    const set = this.subscribers.get(uid);
    return set ? set.size : 0;
  }
}
