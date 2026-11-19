import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { Certificate } from './certificate.entity.js';
import { CertificateResponse } from '../learning/learning.responses.js';

@Injectable()
export class CertificatesService {
  constructor(@Inject(DataSource) private readonly source: DataSource) {}

  async issue(
    userId: string,
    courseId: string,
    manager: EntityManager,
  ): Promise<void> {
    await manager.query(
      `
      INSERT INTO "certificates" ("userId", "courseId", "serialNo") VALUES ($1, $2, $3)
      ON CONFLICT ("userId", "courseId") DO NOTHING`,
      [userId, courseId, `LMS-${randomUUID().toUpperCase()}`],
    );
  }

  async mine(userId: string): Promise<CertificateResponse[]> {
    const certificates = await this.source
      .getRepository(Certificate)
      .find({
        where: { userId },
        order: { issuedAt: 'DESC', serialNo: 'ASC' },
      });
    return certificates.map(
      (certificate) => new CertificateResponse(certificate),
    );
  }

  async lookup(serialNo: string): Promise<CertificateResponse> {
    const certificate = await this.source
      .getRepository(Certificate)
      .findOneBy({ serialNo });
    if (!certificate) throw new NotFoundException('Certificate not found');
    return new CertificateResponse(certificate);
  }
}
