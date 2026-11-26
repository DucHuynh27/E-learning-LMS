import { accountOrIpTracker, loginTracker } from './throttling.js';

describe('throttling trackers', () => {
  it('loginTracker tách bucket theo email + IP (không khoá lây qua IP khác)', () => {
    const fromA = loginTracker({ body: { email: 'A@x.com' }, ip: '1.1.1.1' } as never, {} as never);
    const fromB = loginTracker({ body: { email: 'a@x.com' }, ip: '2.2.2.2' } as never, {} as never);
    const sameKey = loginTracker({ body: { email: 'a@x.com' }, ip: '1.1.1.1' } as never, {} as never);

    expect(fromA).toBe('login:a@x.com:1.1.1.1');
    expect(fromB).toBe('login:a@x.com:2.2.2.2');
    expect(sameKey).toBe(fromA);
  });

  it('loginTracker fallback theo IP khi thiếu email', () => {
    expect(loginTracker({ body: {}, ip: '9.9.9.9' } as never, {} as never)).toBe(
      'login:ip:9.9.9.9',
    );
  });

  it('accountOrIpTracker theo user khi có, ngược lại theo IP', () => {
    expect(
      accountOrIpTracker({ user: { userId: 'u1' }, ip: '1.1.1.1' } as never, {} as never),
    ).toBe('user:u1');
    expect(accountOrIpTracker({ ip: '1.1.1.1' } as never, {} as never)).toBe(
      'ip:1.1.1.1',
    );
  });
});
