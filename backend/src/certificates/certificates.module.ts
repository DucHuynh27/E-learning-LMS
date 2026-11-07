import { Module } from '@nestjs/common';
import { CertificatesService } from './certificates.service.js';
import { CertificatesController } from './certificates.controller.js';

@Module({
  controllers: [CertificatesController],
  providers: [CertificatesService],
  exports: [CertificatesService],
})
export class CertificatesModule {}
