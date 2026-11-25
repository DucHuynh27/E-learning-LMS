import 'reflect-metadata';
import { instanceToPlain } from 'class-transformer';
import { Role, User } from './user.entity.js';

describe('User serialization', () => {
  it('loại passwordHash khỏi output khi serialize entity', () => {
    const user = Object.assign(new User(), {
      id: 'user-1',
      email: 'student@example.com',
      passwordHash: 'stored-hash',
      fullName: 'Student',
      role: Role.STUDENT,
    });

    const plain = instanceToPlain(user);

    expect(plain).not.toHaveProperty('passwordHash');
    expect(plain).toMatchObject({
      id: 'user-1',
      email: 'student@example.com',
      role: Role.STUDENT,
    });
  });
});
