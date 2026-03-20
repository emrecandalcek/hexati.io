// ============================================================
// net.js — HEXATİ client networking layer (Socket.io wrapper)
// ============================================================
class NetworkManager {
  constructor() {
    this.socket    = null;
    this.myId      = null;
    this.roomId    = null;
    this.connected = false;
    this._handlers = {};
  }

  connect(serverUrl) {
    return new Promise((resolve, reject) => {
      this.socket = io(serverUrl, { transports: ['websocket', 'polling'] });

      this.socket.on('connect', () => {
        this.connected = true;
        console.log('[Net] Bağlandı:', this.socket.id);
        resolve();
      });

      this.socket.on('connect_error', err => {
        console.error('[Net] Bağlantı hatası:', err.message);
        reject(err);
      });

      this.socket.on('disconnect', reason => {
        this.connected = false;
        console.warn('[Net] Bağlantı kesildi:', reason);
        this._emit('disconnect', reason);
      });

      this.socket.on('reconnect', () => {
        this.connected = true;
        this._emit('reconnect');
      });

      // Game events
      this.socket.on('game:init',         d => this._emit('game:init', d));
      this.socket.on('game:state',        d => this._emit('game:state', d));
      this.socket.on('game:events',       d => this._emit('game:events', d));
      this.socket.on('game:playerJoined', d => this._emit('game:playerJoined', d));
      this.socket.on('game:playerLeft',   d => this._emit('game:playerLeft', d));
      this.socket.on('game:respawn',      d => this._emit('game:respawn', d));
      this.socket.on('game:shopOk',       d => this._emit('game:shopOk', d));
      this.socket.on('room:joined',       d => this._emit('room:joined', d));
      this.socket.on('room:error',        d => this._emit('room:error', d));
      this.socket.on('chat:msg',          d => this._emit('chat:msg', d));
      this.socket.on('pong_check',        () => this._emit('pong_check'));
    });
  }

  // FIX: diff parametresi eklendi — sunucu bu parametreyi zorunlu bekliyor
  joinRoom(diff, roomId, name, color) {
    this.socket.emit('room:join', { diff, roomId, name, color });
  }

  sendDir(dir) {
    if (this.connected) this.socket.emit('input:dir', dir);
  }

  sendBuy(key) {
    if (this.connected) this.socket.emit('shop:buy', { key });
  }

  sendRespawn() {
    if (this.connected) this.socket.emit('player:respawn');
  }

  sendChat(text) {
    if (this.connected) this.socket.emit('chat:msg', { text });
  }

  ping() {
    if (this.connected) this.socket.emit('ping_check');
  }

  on(event, fn) {
    if (!this._handlers[event]) this._handlers[event] = [];
    this._handlers[event].push(fn);
  }

  off(event, fn) {
    if (!this._handlers[event]) return;
    this._handlers[event] = this._handlers[event].filter(h => h !== fn);
  }

  _emit(event, data) {
    const hs = this._handlers[event];
    if (hs) hs.forEach(h => h(data));
  }

  disconnect() {
    if (this.socket) { this.socket.disconnect(); this.socket = null; }
    this.connected = false;
  }
}
