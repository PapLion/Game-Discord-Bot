import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ScopedEventEmitter, GAME_EVENTS } from '../src/infrastructure/events/ScopedEventEmitter';

describe('ScopedEventEmitter', () => {
  let emitter: ScopedEventEmitter;

  beforeEach(() => {
    emitter = new ScopedEventEmitter();
  });

  describe('forSession()', () => {
    it('creates a new emitter for a session', () => {
      const sessionId = 'session-001';
      const sessionEmitter = emitter.forSession(sessionId);

      expect(sessionEmitter).toBeDefined();
      expect(emitter.hasSession(sessionId)).toBe(true);
    });

    it('returns the same emitter for the same session', () => {
      const sessionId = 'session-001';
      const emitter1 = emitter.forSession(sessionId);
      const emitter2 = emitter.forSession(sessionId);

      expect(emitter1).toBe(emitter2);
    });

    it('creates independent emitters for different sessions', () => {
      const emitter1 = emitter.forSession('session-A');
      const emitter2 = emitter.forSession('session-B');

      expect(emitter1).not.toBe(emitter2);
    });
  });

  describe('session isolation', () => {
    it('events from session A do NOT reach session B', () => {
      const sessionA = 'session-A';
      const sessionB = 'session-B';

      const receivedFromA: unknown[] = [];
      const receivedFromB: unknown[] = [];

      // Listener en sesión A
      emitter.forSession(sessionA).on(GAME_EVENTS.PLAYER_JOINED, payload => {
        receivedFromA.push(payload);
      });

      // Listener en sesión B
      emitter.forSession(sessionB).on(GAME_EVENTS.PLAYER_JOINED, payload => {
        receivedFromB.push(payload);
      });

      // Emitir SOLO en sesión A
      emitter
        .forSession(sessionA)
        .emit(GAME_EVENTS.PLAYER_JOINED, { sessionId: sessionA, player: 'test' });

      expect(receivedFromA).toHaveLength(1);
      expect(receivedFromB).toHaveLength(0); // B NO recibió nada
    });

    it('multiple sessions coexist independently', () => {
      const sessions = ['sess-1', 'sess-2', 'sess-3'];
      const listeners: Array<{ session: string; count: number }> = [];

      sessions.forEach(sessionId => {
        emitter.forSession(sessionId).on(GAME_EVENTS.GAME_START, payload => {
          listeners.push({ session: sessionId, count: 1 });
        });
      });

      // Emitir en todas las sesiones
      sessions.forEach(sessionId => {
        emitter.forSession(sessionId).emit(GAME_EVENTS.GAME_START, { sessionId });
      });

      expect(listeners).toHaveLength(3);
      expect(listeners.filter(l => l.session === 'sess-1')).toHaveLength(1);
      expect(listeners.filter(l => l.session === 'sess-2')).toHaveLength(1);
      expect(listeners.filter(l => l.session === 'sess-3')).toHaveLength(1);
    });

    it('each session only receives its own events', () => {
      const receivedA: string[] = [];
      const receivedB: string[] = [];

      emitter.forSession('A').on('custom:event', (msg: unknown) => {
        receivedA.push(msg as string);
      });

      emitter.forSession('B').on('custom:event', (msg: unknown) => {
        receivedB.push(msg as string);
      });

      // Emitir 3 eventos solo en A
      emitter.forSession('A').emit('custom:event', 'event-A-1');
      emitter.forSession('A').emit('custom:event', 'event-A-2');
      emitter.forSession('A').emit('custom:event', 'event-A-3');

      expect(receivedA).toHaveLength(3);
      expect(receivedA).toEqual(['event-A-1', 'event-A-2', 'event-A-3']);
      expect(receivedB).toHaveLength(0);
    });
  });

  describe('destroySession()', () => {
    it('cleans up all listeners for a session', () => {
      const sessionId = 'session-001';
      const sessionEmitter = emitter.forSession(sessionId);

      const received: unknown[] = [];
      const handler = (payload: unknown) => {
        received.push(payload);
      };

      sessionEmitter.on(GAME_EVENTS.GAME_START, handler);
      sessionEmitter.emit(GAME_EVENTS.GAME_START, {});

      expect(received).toHaveLength(1);

      // Destroy session
      emitter.destroySession(sessionId);

      // El emitter ya no existe
      expect(emitter.hasSession(sessionId)).toBe(false);

      // Crear un nuevo emitter para la misma sesión (nuevo)
      const newEmitter = emitter.forSession(sessionId);
      newEmitter.emit(GAME_EVENTS.GAME_START, { new: true });

      // El handler anterior NO fue registrado en el nuevo emitter
      expect(received).toHaveLength(1);
    });

    it('removes session from active count', () => {
      emitter.forSession('sess-1');
      emitter.forSession('sess-2');
      emitter.forSession('sess-3');

      expect(emitter.getActiveSessionCount()).toBe(3);

      emitter.destroySession('sess-2');

      expect(emitter.getActiveSessionCount()).toBe(2);
    });

    it('calling destroySession on non-existent session is safe', () => {
      expect(() => emitter.destroySession('non-existent')).not.toThrow();
    });

    it('destroyed session cannot emit/receive events', () => {
      const sessionId = 'temp-session';
      const received: unknown[] = [];

      emitter.forSession(sessionId).on('test', (data: unknown) => {
        received.push(data);
      });

      emitter.destroySession(sessionId);

      // Intentar emitir en la sesión destruida (crea nuevo emitter vacío)
      emitter.forSession(sessionId).emit('test', 'should not be received');

      // No debería recibir nada porque el handler fue removido
      expect(received).toHaveLength(0);
    });
  });

  describe('global() events', () => {
    it('global events reach all global listeners', () => {
      const received1: unknown[] = [];
      const received2: unknown[] = [];

      emitter.global().on(GAME_EVENTS.GAME_END, payload => {
        received1.push(payload);
      });

      emitter.global().on(GAME_EVENTS.GAME_END, payload => {
        received2.push(payload);
      });

      emitter.global().emit(GAME_EVENTS.GAME_END, { global: true });

      expect(received1).toHaveLength(1);
      expect(received2).toHaveLength(1);
    });

    it('global events are independent of session emitters', () => {
      const sessionReceived: unknown[] = [];
      const globalReceived: unknown[] = [];

      emitter.forSession('session-1').on(GAME_EVENTS.GAME_WINNER, p => {
        sessionReceived.push(p);
      });

      emitter.global().on(GAME_EVENTS.GAME_WINNER, p => {
        globalReceived.push(p);
      });

      // Emitir en sesión
      emitter.forSession('session-1').emit(GAME_EVENTS.GAME_WINNER, { from: 'session' });

      // Emitir global
      emitter.global().emit(GAME_EVENTS.GAME_WINNER, { from: 'global' });

      expect(sessionReceived).toHaveLength(1);
      expect(globalReceived).toHaveLength(1);
    });
  });

  describe('hasSession()', () => {
    it('returns true for existing session', () => {
      emitter.forSession('existing');
      expect(emitter.hasSession('existing')).toBe(true);
    });

    it('returns false for non-existing session', () => {
      expect(emitter.hasSession('non-existing')).toBe(false);
    });
  });

  describe('getActiveSessionCount()', () => {
    it('returns 0 for new emitter', () => {
      const freshEmitter = new ScopedEventEmitter();
      expect(freshEmitter.getActiveSessionCount()).toBe(0);
    });

    it('returns correct count after creating sessions', () => {
      emitter.forSession('s1');
      emitter.forSession('s2');
      emitter.forSession('s3');

      expect(emitter.getActiveSessionCount()).toBe(3);
    });

    it('decrements count after destroying sessions', () => {
      emitter.forSession('s1');
      emitter.forSession('s2');
      emitter.destroySession('s1');

      expect(emitter.getActiveSessionCount()).toBe(1);
    });
  });

  describe('destroyAllSessions()', () => {
    it('removes all session emitters', () => {
      emitter.forSession('s1');
      emitter.forSession('s2');
      emitter.forSession('s3');

      emitter.destroyAllSessions();

      expect(emitter.getActiveSessionCount()).toBe(0);
    });

    it('does not affect global emitter', () => {
      const globalReceived: unknown[] = [];
      emitter.global().on(GAME_EVENTS.GAME_END, p => {
        globalReceived.push(p);
      });

      emitter.destroyAllSessions();

      emitter.global().emit(GAME_EVENTS.GAME_END, {});

      expect(globalReceived).toHaveLength(1);
    });
  });

  describe('resetGlobal()', () => {
    it('clears all global listeners', () => {
      const received: unknown[] = [];
      emitter.global().on(GAME_EVENTS.GAME_END, p => {
        received.push(p);
      });

      emitter.resetGlobal();

      emitter.global().emit(GAME_EVENTS.GAME_END, {});

      expect(received).toHaveLength(0);
    });
  });

  describe('event constants', () => {
    it('GAME_EVENTS contains all expected events', () => {
      expect(GAME_EVENTS.PLAYER_JOINED).toBe('player:joined');
      expect(GAME_EVENTS.GAME_START).toBe('game:start');
      expect(GAME_EVENTS.GAME_ROUND).toBe('game:round');
      expect(GAME_EVENTS.GAME_WINNER).toBe('game:winner');
      expect(GAME_EVENTS.GAME_END).toBe('game:end');
    });
  });
});
