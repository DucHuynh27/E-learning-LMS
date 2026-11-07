import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { createServer, type Socket } from 'node:net';
import { PublishedLessonCache } from './published-lesson-cache.service.js';

describe('Published lesson Redis cache adapter', () => {
  let respond: (socket: Socket) => void;
  const server = createServer((socket) =>
    socket.once('data', () => respond(socket)),
  );
  let cache: PublishedLessonCache;
  beforeAll(async () => {
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    const address = server.address();
    if (!address || typeof address === 'string')
      throw new Error('No TCP address');
    cache = new PublishedLessonCache(
      new ConfigService({
        REDIS_HOST: '127.0.0.1',
        REDIS_PORT: address.port,
        REDIS_PASSWORD: 'test-only',
      }),
    );
  });
  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });

  it('reads pipelined AUTH and fragmented bulk replies', async () => {
    respond = (socket) => {
      socket.write('+OK\r\n$2\r\n');
      setTimeout(() => socket.end('12\r\n'), 5);
    };
    expect(await cache.get('fixture')).toBe(12);
  });
  it('treats a missing key as a cache miss', async () => {
    respond = (socket) => {
      socket.end('+OK\r\n$-1\r\n');
    };
    expect(await cache.get('fixture')).toBeUndefined();
  });
  it('ignores authentication errors and invalid cached counts', async () => {
    respond = (socket) => {
      socket.end('-WRONGPASS invalid\r\n');
    };
    expect(await cache.get('fixture')).toBeUndefined();
    respond = (socket) => {
      socket.end('+OK\r\n$2\r\n-1\r\n');
    };
    expect(await cache.get('fixture')).toBeUndefined();
  });
  it('reads PING and handles SET/DEL string and integer replies', async () => {
    respond = (socket) => {
      socket.end('+OK\r\n+PONG\r\n');
    };
    expect(await cache.ping()).toBe(true);
    respond = (socket) => {
      socket.end('+OK\r\n+OK\r\n');
    };
    await expect(cache.set('fixture', 2)).resolves.toBeUndefined();
    respond = (socket) => {
      socket.end('+OK\r\n:1\r\n');
    };
    await expect(cache.invalidate('fixture')).resolves.toBeUndefined();
  });
  it('bounds stalled connections and malformed replies', async () => {
    respond = () => {};
    expect(await cache.get('fixture')).toBeUndefined();
    respond = (socket) => {
      socket.end('*1\r\n');
    };
    expect(await cache.get('fixture')).toBeUndefined();
  });
});
