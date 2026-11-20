import { describe, expect, it } from 'vitest';
import { slugify } from './slug.util.js';

describe('slugify', () => {
  it('converts Vietnamese text with accents to clean slug', () => {
    expect(slugify('Khóa học Lập trình NestJS nâng cao')).toBe(
      'khoa-hoc-lap-trinh-nestjs-nang-cao',
    );
  });

  it('handles "đ" and "Đ" correctly', () => {
    expect(slugify('Đường đời và Định mệnh')).toBe('duong-doi-va-dinh-menh');
  });

  it('removes special characters and replaces spaces with dashes', () => {
    expect(slugify('Course #1: Node.js & TypeScript @ 2026!')).toBe(
      'course-1-nodejs-typescript-2026',
    );
  });

  it('collapses multiple dashes and trims ends', () => {
    expect(slugify('---hello---world---')).toBe('hello-world');
  });

  it('falls back to default slug if input is empty or has only specials', () => {
    const slug = slugify('??? !!!');
    expect(slug).toMatch(/^course-\d+$/);
  });
});
