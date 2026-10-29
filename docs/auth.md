# Module: Auth & nền tảng

> Owner: @lead · Điền theo [`_TEMPLATE.md`](_TEMPLATE.md)

## Phạm vi
`ConfigModule` (EnvVars) · `AuthModule` · `UsersModule` · cross-cutting (ValidationPipe,
interceptors, exception filter) · TypeORM DataSource.

## Ghi chú
- Giải thích **vì sao** `data-source.ts` dùng chung cho runtime và CLI.
- Giải thích luồng JWT (access/refresh), cách `RolesGuard` + `@Roles()` hoạt động.
- Nêu lý do `passwordHash` để `select: false` và vẫn lấy được khi login.
