import { RedisLock } from './redis.lock';

describe('RedisLock', () => {
  it('settles on a Redis error', async() => {
    const evalScript = jest.fn().mockRejectedValue(new Error('Redis is unavailable'));
    await expect(RedisLock({ eval: evalScript })('sheet')).rejects.toThrow('Redis is unavailable');
  });

  it.each([false, true])('bounds the wait when the command stalls = %s', async(stalled) => {
    const evalScript = jest.fn(() => stalled ? new Promise(() => {}) : Promise.resolve(0));
    await expect(RedisLock({ eval: evalScript }, 1)('sheet', 15)).rejects.toThrow('Timed out');
  });

  it('deduplicates keys and uses the same unique owner when releasing', async() => {
    const evalScript = jest.fn().mockResolvedValue(1);
    const lock = RedisLock({ eval: evalScript });
    const unlock = await lock(['sheet', 'sheet']);
    const owner = evalScript.mock.calls[0]![3];
    expect(evalScript.mock.calls[0]!.slice(1)).toEqual([1, 'lock.sheet', owner, 5000]);
    await unlock();
    expect(evalScript.mock.calls[1]!.slice(1)).toEqual([1, 'lock.sheet', owner]);
    await lock('sheet');
    expect(evalScript.mock.calls[2]![3]).not.toBe(owner);
  });
});
