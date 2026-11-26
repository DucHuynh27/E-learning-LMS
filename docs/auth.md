# Module: Auth & nền tảng

> Owner: @lead · Viết theo [`_TEMPLATE.md`](_TEMPLATE.md)

## 1. Tổng quan
Xác thực người dùng (JWT) + phân quyền theo vai trò (RBAC), và lớp **cross-cutting** dùng chung cho mọi request: validation, bọc response, xử lý lỗi, versioning. Đây là nền mà mọi module khác cắm vào.

## 2. Luồng dữ liệu
```
Request
  → JwtAuthGuard (toàn cục) ── nếu @Public() → bỏ qua
        └─ JwtStrategy: verify access token → request.user = { userId, email, role }
  → RolesGuard ── đọc @Roles() metadata, so role
  → ThrottlerGuard ── đếm theo tài khoản (req.user) nếu đã xác thực, ngược lại theo IP; vượt ngưỡng → 429
  → Controller → Service → UsersRepository → DB
  → ClassSerializerInterceptor → TransformInterceptor (bọc { data })
  (lỗi ở bất kỳ đâu → AllExceptionsFilter)
```

## 3. Các file chính
| File | Trách nhiệm |
| --- | --- |
| `src/config/env.validation.ts` | `EnvVars` + `validateEnv` — chặn app khởi động nếu env sai/thiếu |
| `src/common/throttling.ts` | Hằng số ngưỡng rate limit (global/login/register/refresh) + `loginTracker` + `throttlerRootOptions()`, dùng chung runtime & test |
| `src/bootstrap.ts` | `configureApp(app)` — gắn CORS, `trust proxy`, pipes/interceptors/filter/versioning; dùng chung cho runtime & e2e |
| `src/common/interceptors/transform.interceptor.ts` | Bọc mọi response thành `{ data }` |
| `src/common/filters/all-exceptions.filter.ts` | Shape lỗi thống nhất, log 5xx |
| `src/database/data-source.ts` | Cấu hình TypeORM dùng chung cho runtime + CLI |
| `src/auth/auth.module.ts` | `JwtModule` + `ThrottlerModule`; đăng ký 3 guard toàn cục theo thứ tự Auth → Roles → Throttler |
| `src/auth/auth.service.ts` | register / login / refresh, cấp token |
| `src/auth/auth.controller.ts` | `POST register/login/refresh`, `GET me` |
| `src/auth/strategies/jwt.strategy.ts` | Verify access token → `AuthenticatedUser` |
| `src/auth/guards/jwt-auth.guard.ts` | Xác thực; tôn trọng `@Public()` |
| `src/auth/guards/roles.guard.ts` | Kiểm tra `@Roles()` |
| `src/auth/decorators/*.ts` | `@Public`, `@Roles`, `@CurrentUser` |
| `src/user/users.service.ts` | Truy cập User, hash mật khẩu |

## 4. Quyết định thiết kế & lý do
- **Guard toàn cục + `@Public()` (secure by default):** mặc định mọi route đều yêu cầu đăng nhập; muốn công khai phải khai báo tường minh. Ngược lại (mặc định mở, tự thêm guard) dễ quên → lộ endpoint.
- **`configureApp(app)` dùng chung `main.ts` và e2e:** nếu mỗi nơi tự cấu hình, e2e tạo app "trần" → test xanh nhưng **không** kiểm chứng pipes/interceptors/versioning thật. Đây là bẫy im lặng nên tách hàm chung.
- **Access + refresh token, hai secret riêng; TTL để dạng số trong env:** access sống ngắn, refresh sống dài. Để TTL là số (giây) thay vì chuỗi `'15m'` để tránh kiểu `StringValue` và dễ validate bằng class-validator.
- **`passwordHash` để `select: false` + `findByEmailForAuth` addSelect:** bình thường không kéo hash ra khỏi DB (an toàn mặc định); chỉ khi đăng nhập mới `addSelect` tường minh.
- **Một thông báo lỗi chung cho login sai:** không phân biệt "email sai" và "mật khẩu sai" → không lộ email nào tồn tại.
- **`@node-rs/argon2` thay vì `argon2`:** bản này phân phối binary qua optional deps, **không có build script** → không vướng cơ chế approve-build của pnpm 12 (máy dev đặt `ignoreScripts: true`, CI thì không).
- **`AllExceptionsFilter` log 5xx nhưng giấu chi tiết:** bug server được ghi log đầy đủ để trace, nhưng client chỉ nhận `Internal server error` — không lộ stack.
- **`EnvVars` crash lúc boot:** sai env phải chết sớm và rõ, thay vì chạy với giá trị rỗng rồi lỗi mơ hồ lúc runtime.

### Hardening (Sprint 3)

- **CORS trong `configureApp`, không ở `main.ts`:** để e2e dùng đúng cấu hình thật. Origin lấy từ `CORS_ORIGIN` (danh sách phân tách dấu phẩy); để trống thì dùng mặc định dev. `credentials: true` kèm danh sách origin tường minh (không dùng `*`) để không vi phạm ràng buộc của trình duyệt.
- **Rate limit bằng `@nestjs/throttler`, ngưỡng gom một chỗ:** mặc định toàn API 100 req/60s; `login` 5, `register` 10, `refresh` 20 req/60s. Hằng số nằm ở `src/common/throttling.ts` để runtime và test dùng chung, tránh lệch số.
- **Login đếm theo email + IP:** `loginTracker` key `${email}:${ip}` (fallback IP khi thiếu email). Vẫn chặn dò mật khẩu vào một account từ cùng một IP, nhưng **không cho một IP khoá đăng nhập của chủ tài khoản từ IP khác** (chống lockout DoS). Spam phân tán nhiều IP vẫn bị ngưỡng toàn cục theo IP chặn.
- **JWT verify đối chiếu user hiện tại:** `JwtStrategy.validate` tra `UsersService.findById` mỗi request — token còn hạn nhưng tài khoản đã xoá → 401, và role được lấy từ DB (không dùng role cũ trong token). Đánh đổi: thêm 1 truy vấn DB mỗi request đã xác thực.
- **`trust proxy` cấu hình được qua `TRUST_PROXY`, mặc định tắt:** chỉ tin `X-Forwarded-For` khi request đến từ proxy thật (số hop, `loopback`, hoặc danh sách IP/CIDR). `EnvVars` **cấm** giá trị `true` trần vì nó cho phép client tự giả IP để né rate limit.
- **`errorMessage` tùy biến thay vì override guard:** `ThrottlerException` mặc định trả chuỗi `"ThrottlerException: Too Many Requests"`. Đặt `errorMessage: 'Too many requests'` giữ response lỗi sạch, và `AllExceptionsFilter` bọc lại thành cùng shape với mọi lỗi khác.
- **Ẩn field nhạy cảm bằng hai lớp:** `passwordHash` vừa `select: false` (không kéo hash khỏi DB) vừa `@Exclude()` (nếu entity lỡ lọt ra ngoài ranh giới DTO thì `ClassSerializerInterceptor` vẫn cắt). DTO ở biên (`toPublicUser`) vẫn là lớp chính.
- **Storage rate limit chọn được qua cấu hình:** mặc định in-memory (một instance, phù hợp dev). Đặt `THROTTLE_STORAGE=redis` + `THROTTLE_REDIS_URL` để nhiều instance dùng chung bộ đếm; `RedisThrottlerStorage` dùng một script Lua (`INCR` + `PEXPIRE`) để tăng/đặt TTL nguyên tử. Nếu Redis không sẵn sàng, storage tạm rơi về in-memory kèm cảnh báo log thay vì làm sập request.
- **Rate limit hai lớp (giải quyết #31 + #37):** trong `AuthModule`, thứ tự provider là `AnonymousIpThrottleGuard` → `JwtAuthGuard` → `RolesGuard` → `ThrottlerGuard`.
  - **Lớp 1 — IP thô, TRƯỚC auth (`AnonymousIpThrottleGuard`, #31):** đếm theo `req.ip` (ngưỡng cao 300 req/60s) trước khi tốn CPU verify JWT. Nhờ vậy request ẩn danh (dội 401 vào route bảo vệ) **vẫn bị đếm và có thể 429**, không né được rate limit. Bucket tách riêng (throttler name `anonymous-ip`).
  - **Lớp 2 — theo tài khoản, SAU auth (`ThrottlerGuard`, #37):** chạy sau khi `req.user` đã có nên tracker `accountOrIpTracker` đếm **theo tài khoản**, nhiều học viên chung IP vẫn có bucket riêng. Login (route công khai) đếm theo email.
  - Hai lớp dùng bucket khác nhau nên không đếm trùng. Có test hồi quy cho cả hai.

## 5. Cơ sở dữ liệu liên quan
| Entity | Trường quan trọng | Index / Unique | Lý do |
| --- | --- | --- | --- |
| `User` | `email`, `passwordHash`, `fullName`, `role`, `avatarUrl?` | unique `email`; index `role` | `email` là định danh đăng nhập (chống trùng); `role` cho truy vấn theo vai trò |

`passwordHash` cột `select: false`.

## 6. API endpoints
| Method | Path | Quyền | Input | Success |
| --- | --- | --- | --- | --- |
| POST | `/v1/auth/register` | Public | `CreateUserDto` | 201 `{ accessToken, refreshToken, user }` |
| POST | `/v1/auth/login` | Public | `LoginDto` | 200 `{ accessToken, refreshToken, user }` |
| POST | `/v1/auth/refresh` | Public | `RefreshDto` | 200 `{ accessToken, refreshToken, user }` |
| GET | `/v1/auth/me` | Auth | — | 200 `AuthenticatedUser` |

`CreateUserDto`: `email` (IsEmail) · `password` (8..72) · `fullName` (1..255).
`user` trả về: `{ id, email, fullName, role }` — **không** có `passwordHash`.

Rate limit (vượt → 429): `login` **5 req/60s theo email + IP**, `register` **10**, `refresh` **20**; quiz đọc **30**, start attempt **10**, submit attempt **5** (theo tài khoản). Route đã xác thực đếm **theo tài khoản**, route công khai theo IP; mặc định toàn cục **100 req/60s**.

## 7. Xử lý lỗi & edge case
- **400** — DTO sai/thiếu (ValidationPipe `whitelist` + `forbidNonWhitelisted`).
- **401** — thiếu/sai/hết hạn token; refresh token không hợp lệ.
- **403** — đã đăng nhập nhưng sai role (RolesGuard).
- **409** — register email đã tồn tại (ConflictException).
- **429** — vượt ngưỡng rate limit (ThrottlerGuard) — `{ statusCode: 429, message: 'Too many requests', ... }`.
- Login sai → 401 với message chung "Invalid credentials".

## 8. Test
- **Unit:** `app.controller.spec.ts` (AppController/AppService) · `auth.service.spec.ts` (register/login/refresh + không lộ `passwordHash`) · `user.entity.spec.ts` (serialize cắt `passwordHash`) · `bootstrap.spec.ts` (CORS theo config, `resolveCorsOrigins`, `parseTrustProxy`).
- **Unit (throttler storage):** `common/throttler-redis.storage.spec.ts` (map kết quả Lua → `ThrottlerStorageRecord`; fallback in-memory khi Redis lỗi; chọn storage theo `THROTTLE_STORAGE`/`THROTTLE_REDIS_URL`).
- **Integration:** `auth-throttle.integration.spec.ts` (login/register/refresh trả 429 sau ngưỡng; email khác không bị khoá lây) · `attempts-throttle.integration.spec.ts` (quiz start/submit 429 theo từng tài khoản) · `quizzes-throttle.integration.spec.ts` (đọc quiz 429 theo từng tài khoản) · `common/trust-proxy.integration.spec.ts` (`trust proxy` bật thì đếm riêng theo client, tắt thì bỏ qua `X-Forwarded-For`) · `common/throttler-order.integration.spec.ts` (throttler theo tài khoản chạy sau auth; đếm riêng theo tài khoản) · `common/anonymous-ip-throttle.integration.spec.ts` (lớp IP thô chạy trước auth: request 401 vẫn bị đếm và bị chặn 429; IP khác có bucket riêng).
- **e2e:** smoke `GET /v1` → `{ data: 'Hello World!' }` (dùng `configureApp`).
- **Smoke thủ công:** register 201 (không lộ hash) · login OK · `/me` có token 200 / không token 401 · validation 400.
- **Còn nợ:** e2e riêng cho auth (register/login/refresh/me) — do `@qa` viết.

## 9. Điểm nhấn kỹ thuật
1. **Secure by default** — guard toàn cục + `@Public()` opt-out.
2. **`configureApp` dùng chung** — e2e kiểm chứng đúng cấu hình thật, không test giả.
3. **Chọn argon2 không build-script** — tránh hẳn bẫy pnpm 12/CI.

## 10. Hạn chế / chưa làm
- **Chưa có refresh token rotation / lưu refresh token** (nằm trong danh sách **CẮT** của `TASKLIST.md`) → chưa thu hồi được token.
- **Rate limit mặc định vẫn là storage in-memory** — đủ cho demo một instance. Muốn đếm đúng trên nhiều instance phải đặt `THROTTLE_STORAGE=redis` + `THROTTLE_REDIS_URL`; nếu Redis chết, storage rơi về in-memory (mất tính chia sẻ, vẫn chạy được).
- **`trust proxy` mặc định tắt** — khi chạy sau proxy mà chưa cấu hình `TRUST_PROXY`: các route đã xác thực vẫn đếm theo tài khoản nên không bị ảnh hưởng; chỉ các route **công khai/ẩn danh** (đếm theo IP) mới có thể dồn chung bucket. Nên đặt `TRUST_PROXY` đúng trong môi trường thật.
- **Rate limit cho route quiz** — đã gắn `@Throttle` cho start (10 req/60s) và submit (5 req/60s), đếm theo tài khoản, tại `@learning` (`attempts.controller.ts`); là thay đổi cross-module do `@lead` thực hiện và cần `@learning` review (đã chỉnh `learning.http.integration.spec.ts` để tắt throttle khi test nghiệp vụ).
- **Swagger hoãn.**
- **Chưa có test DB riêng cho e2e** (`@qa`).
- `JWT_ACCESS_TTL`/`JWT_REFRESH_TTL` để mặc định trong code nếu env thiếu.
