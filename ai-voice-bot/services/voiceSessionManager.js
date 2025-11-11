import { WebSocketServer } from 'ws';
import { createRealtimeVoiceBridge } from './realtimeVoiceBridge.js';

export const registerVoiceSocketHandling = (server) => {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    try {
      const { pathname } = new URL(request.url, `http://${request.headers.host}`);

      if (pathname === '/voice/stream') {
        wss.handleUpgrade(request, socket, head, (websocket) => {
          try {
            createRealtimeVoiceBridge(websocket);
          } catch (error) {
            console.error('Unable to initialise realtime bridge', error);
            websocket.close(1011, 'Unable to establish realtime session.');
          }
        });
      } else {
        socket.destroy();
      }
    } catch (error) {
      console.error('Failed to parse upgrade URL', error);
      socket.destroy();
    }
  });
};
