import { describe, expect, it } from 'vitest';
import { censor, redact } from '../redact';
class AppishError extends Error {
  constructor(
    message: string,
    readonly details: { password: string; entityType: string },
  ) {
    super(message);
    this.name = 'AppishError';
  }
}
describe('log redaction', () => {
  it('ADMIN-B18 censors secrets at every nesting depth, in arrays, and under any key spelling', () => {
    const line = redact({
      requestId: 'req-1',
      password: 'root-level',
      request: { headers: { Authorization: 'Bearer abc', Cookie: 'eos_session=xyz' } },
      job: { payload: { provider: { api_key: 'sk-live' }, prompts: ['private brief'] } },
      attempts: [{ body: { newPassword: 'p1' } }, { body: { 'Set-Cookie': 'eos_session=2' } }],
      note: { privateNotes: 'confidential' },
    });
    expect(JSON.stringify(line)).not.toMatch(/root-level|Bearer abc|eos_session|sk-live/u);
    expect(JSON.stringify(line)).not.toMatch(/private brief|p1|confidential/u);
    expect(line.requestId).toBe('req-1');
    expect(line.password).toBe(censor);
  });
  it('ADMIN-B18 serializes errors through an allowlist and keeps their cause', () => {
    const error = new AppishError('rule_violation', { password: 'leaked', entityType: 'task' });
    error.cause = new Error('inner');
    const line = redact({ err: error });
    expect(line.err).toMatchObject({
      type: 'AppishError',
      message: 'rule_violation',
      cause: { type: 'Error', message: 'inner' },
    });
    expect(JSON.stringify(line)).not.toMatch(/leaked|entityType/u);
  });
  it('ADMIN-B18 cuts cycles without censoring a value that merely repeats', () => {
    const shared = { name: 'workspace' };
    const cyclic: Record<string, object> = { shared, also: shared };
    cyclic.self = cyclic;
    const line = redact(cyclic);
    expect(line.shared).toEqual({ name: 'workspace' });
    expect(line.also).toEqual({ name: 'workspace' });
    expect(line.self).toBe(censor);
  });
});
