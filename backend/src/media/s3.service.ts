import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'node:stream';

@Injectable()
export class S3Service implements OnModuleInit, OnModuleDestroy {
  readonly bucket: string;
  readonly presignedTtl: number;
  private readonly client: S3Client;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.getOrThrow<string>('MINIO_BUCKET');
    this.presignedTtl = this.config.getOrThrow<number>('MINIO_PRESIGNED_TTL');
    this.client = new S3Client({
      endpoint: this.config.getOrThrow<string>('MINIO_ENDPOINT'),
      region: this.config.getOrThrow<string>('MINIO_REGION'),
      credentials: {
        accessKeyId: this.config.getOrThrow<string>('MINIO_ROOT_USER'),
        secretAccessKey: this.config.getOrThrow<string>('MINIO_ROOT_PASSWORD'),
      },
      forcePathStyle: true,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } })
        .$metadata?.httpStatusCode;
      if (status !== 404) throw error;
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
  }

  onModuleDestroy(): void {
    this.client.destroy();
  }

  createUploadUrl(key: string, contentType: string) {
    return getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
      }),
      { expiresIn: this.presignedTtl },
    );
  }

  createPlaybackUrl(key: string) {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: this.presignedTtl },
    );
  }

  async assertObjectExists(key: string): Promise<void> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } })
        .$metadata?.httpStatusCode;
      if (status === 404)
        throw new NotFoundException('Uploaded object not found');
      throw error;
    }
  }

  async downloadObject(key: string): Promise<Readable> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!(result.Body instanceof Readable)) {
      throw new Error(`Object ${key} did not return a readable stream`);
    }
    return result.Body;
  }

  async uploadThumbnail(key: string, body: Buffer): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: 'image/jpeg',
      }),
    );
  }
}
