/**
 * APITable <https://github.com/apitable/apitable>
 * Copyright (C) 2022 APITable Ltd. <https://apitable.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';

const acquireScript = fs.readFileSync(path.resolve(__dirname, 'list.lock.lua'), 'utf8');
const releaseScript = [
  'for _, key in ipairs(KEYS) do',
  '  if redis.call("GET", key) == ARGV[1] then',
  '    redis.call("DEL", key)',
  '  end',
  'end',
].join('\n');

export function RedisLock(client: { eval(script: string, keyCount: number, ...args: (string | number)[]): Promise<unknown> }, retryDelay = 50) {
  return async (lockNames: string | string[], timeout = 5000): Promise<() => Promise<void>> => {
    const names = typeof lockNames === 'string' ? [lockNames] : lockNames;
    const keys = [...new Set(names)].map(name => 'lock.' + name);
    if (!keys.length) {
      return async () => {};
    }

    const owner = randomUUID();
    const release = async () => {
      await client.eval(releaseScript, keys.length, ...keys, owner);
    };
    const deadline = performance.now() + timeout;
    const timeoutError = new Error('Timed out waiting for the changeset lock');
    const acquire = async () => {
      while (performance.now() < deadline) {
        if (await client.eval(acquireScript, keys.length, ...keys, owner, timeout) === 1) {
          if (performance.now() < deadline) {
            return release;
          }
          await release();
          break;
        }
        const remaining = deadline - performance.now();
        if (remaining > 0) {
          await new Promise<void>(resolve => setTimeout(resolve, Math.min(retryDelay, remaining)));
        }
      }
      throw timeoutError;
    };

    let timer: ReturnType<typeof setTimeout> | undefined;
    const waitLimit = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(timeoutError), timeout);
    });
    try {
      return await Promise.race([acquire(), waitLimit]);
    } finally {
      clearTimeout(timer);
    }
  };
}
