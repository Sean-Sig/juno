import { Socket } from "phoenix";

const WS_URL = process.env.EXPO_PUBLIC_WS_URL ?? "ws://localhost:4000/socket";

let _socket: Socket | null = null;

export function getSocket(): Socket {
  if (!_socket) {
    _socket = new Socket(WS_URL, { params: {} });
    _socket.connect();
  }
  return _socket;
}

export function disconnectSocket() {
  _socket?.disconnect();
  _socket = null;
}
