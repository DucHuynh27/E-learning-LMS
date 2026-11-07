import { Controller, Get, Inject, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface.js';
import { CertificateParamsDto } from '../learning/dto/learning-params.dto.js';
import { CertificatesService } from './certificates.service.js';

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ]!,
  );
}

@Controller('certificates')
export class CertificatesController {
  constructor(
    @Inject(CertificatesService)
    private readonly certificates: CertificatesService,
  ) {}

  @Get('me')
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.certificates.mine(user.userId);
  }

  @Public()
  @Get(':serialNo')
  lookup(@Param() params: CertificateParamsDto) {
    return this.certificates.lookup(params.serialNo);
  }

  @Public()
  @Get(':serialNo/verify')
  async verify(
    @Param() params: CertificateParamsDto,
    @Res() response: Response,
  ): Promise<void> {
    const certificate = await this.certificates.lookup(params.serialNo);
    response.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
    );
    response
      .type('html')
      .send(
        `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Xác thực chứng chỉ LMS</title><style>body{font:16px system-ui,sans-serif;max-width:46rem;margin:4rem auto;padding:0 1rem;line-height:1.7}dt{font-weight:600}dd{margin:0 0 1rem;overflow-wrap:anywhere}</style></head><body><h1>Chứng chỉ hợp lệ</h1><dl><dt>Số chứng chỉ</dt><dd>${escapeHtml(certificate.serialNo)}</dd><dt>Mã khóa học</dt><dd>${escapeHtml(certificate.courseId)}</dd><dt>Mã học viên</dt><dd>${escapeHtml(certificate.userId)}</dd><dt>Ngày cấp</dt><dd>${escapeHtml(certificate.issuedAt.toISOString())}</dd></dl></body></html>`,
      );
  }
}
