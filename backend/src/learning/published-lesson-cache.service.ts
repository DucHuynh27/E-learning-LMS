import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createConnection } from 'node:net';
import { LearningInfrastructureDto } from './dto/learning-infrastructure.dto.js';

function readReply(
  buffer: Buffer,
  offset: number,
): { value: string | null; end: number } | undefined {
  const end = buffer.indexOf('\r\n', offset);
  if (end < 0) return undefined;
  const type = buffer.toString('ascii', offset, offset + 1);
  const header = buffer.toString('utf8', offset + 1, end);
  if (type === '-') throw new Error('Redis command failed');
  if (type === '+' || type === ':') return { value: header, end: end + 2 };
  if (type !== '$') throw new Error('Unsupported Redis reply');
  const length = Number(header);
  if (length === -1) return { value: null, end: end + 2 };
  if (!Number.isInteger(length) || length < 0 || length > 1024)
    throw new Error('Invalid Redis reply');
  if (buffer.length < end + 2 + length + 2) return undefined;
  return {
    value: buffer.toString('utf8', end + 2, end + 2 + length),
    end: end + 2 + length + 2,
  };
}

@Injectable()
export class PublishedLessonCache {
  private readonly config: LearningInfrastructureDto;
  constructor(@Inject(ConfigService) config: ConfigService) {
    this.config = LearningInfrastructureDto.from(config);
  }

  async get(courseId: string): Promise<number | undefined> {
    const value = await this.command(['GET', `learning:published:${courseId}`]);
    if (value === undefined || value === null || !/^\d+$/.test(value))
      return undefined;
    const count = Number(value);
    return Number.isSafeInteger(count) ? count : undefined;
  }

  async set(courseId: string, count: number): Promise<void> {
    await this.command([
      'SET',
      `learning:published:${courseId}`,
      String(count),
      'EX',
      '30',
    ]);
  }

  async invalidate(courseId: string): Promise<void> {
    await this.command(['DEL', `learning:published:${courseId}`]);
  }

  async ping(): Promise<boolean> {
    return (await this.command(['PING'])) === 'PONG';
  }

  // A short-lived connection avoids sharing a socket between requests; cache failures fall back to SQL.
  private command(command: string[]): Promise<string | null | undefined> {
    return new Promise((resolve) => {
      const password = this.config.redisPassword;
      const commands = password ? [['AUTH', password], command] : [command];
      const socket = createConnection({
        host: this.config.redisHost,
        port: this.config.redisPort,
      });
      let buffer = Buffer.alloc(0);
      let offset = 0;
      let replies = 0;
      let settled = false;
      const finish = (value: string | null | undefined) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        resolve(value);
      };
      socket.setTimeout(500, () => finish(undefined));
      socket.on('error', () => finish(undefined));
      socket.on('close', () => finish(undefined));
      socket.on('connect', () => {
        socket.write(
          commands
            .map(
              (parts) =>
                `*${parts.length}\r\n${parts.map((part) => `$${Buffer.byteLength(part)}\r\n${part}\r\n`).join('')}`,
            )
            .join(''),
        );
      });
      socket.on('data', (data: Buffer) => {
        buffer = Buffer.concat([buffer, data]);
        if (buffer.length > 4096) return finish(undefined);
        try {
          let reply;
          while ((reply = readReply(buffer, offset))) {
            offset = reply.end;
            if (++replies === commands.length) return finish(reply.value);
          }
        } catch {
          finish(undefined);
        }
      });
    });
  }
}
