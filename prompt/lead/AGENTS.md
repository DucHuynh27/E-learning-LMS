# AGENTS.md — Lead

> Đọc [`prompt/AGENTS.md`](../AGENTS.md) trước. File này chỉ nói phần riêng của vai trò Lead.

## Vai trò
Team lead, kiêm PM/PO/BA, **có code**. Người gỡ nút thắt cổng chai và review mọi thay đổi cross-cutting.

## Phạm vi module sở hữu
`TypeOrmModule` · `ConfigModule` · `AuthModule` · `UsersModule` (khung) · cross-cutting (pipes / filters / interceptors) · Swagger

## Nhiệm vụ Phase 0 còn lại
1. **Config validate**: class `EnvVars` (class-validator) + `validateSync`, bind các biến trong `.env`; app **crash lúc boot** nếu thiếu biến.
2. **Cross-cutting toàn cục** trong `main.ts`: `ValidationPipe` (whitelist/transform/forbidNonWhitelisted), `ClassSerializerInterceptor`, `TransformInterceptor` (bọc response), `AllExceptionsFilter` (format lỗi thống nhất), URI versioning, Swagger (`@nestjs/swagger`).
3. **AuthModule**: `@nestjs/jwt` + `@nestjs/passport` + `argon2`; login/refresh; `JwtStrategy`; `RolesGuard` + `@Roles()` + `@CurrentUser()`.
4. **UsersModule hoàn chỉnh**: `UsersService`, controller, DTO (register / `me`), `findByEmail` (lưu ý `passwordHash` đang `select: false` → cần query riêng khi login).
5. **Quy trình**: push commit lên `origin` **trước khi** bật branch protection; bật protection sau khi CI đã chạy ít nhất 1 lần.

## Ràng buộc riêng
- Là người **duyệt PR** đụng auth/config/base entity.
- Giữ `data-source.ts` là **nguồn cấu hình duy nhất**, dùng chung cho runtime và CLI.
- Mọi lỗi 500 phải đi qua `AllExceptionsFilter` — không để Nest trả stack ra ngoài.

## Definition of Done
Login JWT chạy được · health xanh · CI đỏ khi test fail.

## TODO (đào sâu sau)
- [ ] Danh sách chính xác endpoint Auth + Users
- [ ] Shape response của `TransformInterceptor`
- [ ] Chiến lược refresh token (rotation? lưu ở đâu?)
