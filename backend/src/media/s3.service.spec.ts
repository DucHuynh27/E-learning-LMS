import { NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { S3Service } from './s3.service.js';

describe('S3Service', () => {
  let config: ConfigService;
  let service: S3Service;
  let send: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    config = {
      getOrThrow: vi.fn((key: string) => {
        const values: Record<string, string | number> = {
          MINIO_BUCKET: 'lms-videos',
          MINIO_PRESIGNED_TTL: '900',
          MINIO_ENDPOINT: 'http://localhost:9000',
          MINIO_REGION: 'us-east-1',
          MINIO_ROOT_USER: 'minioadmin',
          MINIO_ROOT_PASSWORD: 'minioadmin',
        };
        return values[key];
      }),
    } as unknown as ConfigService;

    service = new S3Service(config);
    send = vi.fn();
    (service as unknown as { client: { send: typeof send } }).client = { send };
  });

  it('coerces MINIO_PRESIGNED_TTL to a number', () => {
    expect(service.presignedTtl).toBe(900);
    expect(service.bucket).toBe('lms-videos');
  });

  it('creates the bucket during onModuleInit if HeadBucket returns 404', async () => {
    send
      .mockRejectedValueOnce({ $metadata: { httpStatusCode: 404 } })
      .mockResolvedValueOnce({});

    await expect(service.onModuleInit()).resolves.toBeUndefined();
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('does not crash onModuleInit when MinIO is unreachable', async () => {
    send.mockRejectedValueOnce(new Error('connect ECONNREFUSED 127.0.0.1:9000'));

    await expect(service.onModuleInit()).resolves.toBeUndefined();
  });

  it('throws NotFoundException when uploaded object does not exist', async () => {
    send.mockRejectedValueOnce({ $metadata: { httpStatusCode: 404 } });

    await expect(
      service.assertObjectExists('videos/missing/original'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
