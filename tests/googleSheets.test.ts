import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GoogleSheetsService } from '../src/services/googleSheets';

function setup(mappings: unknown[][]) {
  const writes: any[] = [];
  const reads: any[] = [];
  const service = new GoogleSheetsService({
    spreadsheetId: 'test-sheet',
    credentials: { client_email: 'test@example.com', private_key: 'unused' },
  });
  (service as any).sheets = { spreadsheets: { values: {
    get: async (request: any) => { reads.push(request); return { data: { values: mappings } }; },
    update: async (request: any) => { writes.push(request); return { data: { updatedCells: 1 } }; },
  } } };
  return { service, writes, reads };
}
const account = (accountName: string, balance = 123, freeAmount?: number) => ({
  accountName, balance, freeAmount, lastUpdated: new Date(),
});

test('matches trimmed and numeric IDs and writes zero balances and free amounts', async () => {
  const { service, writes, reads } = setup([[123, 7], [' Other ', '8']]);
  await service.updateSheet([account(' 123 ', 0, 0), account('Other')]);
  assert.equal(reads[0].range, 'Finance!Q6:R');
  assert.deepEqual(writes.find(write => write.range === 'Finance!F7').requestBody.values, [['0']]);
  assert.deepEqual(writes.find(write => write.range === 'Finance!L7').requestBody.values, [['0']]);
  assert.equal(writes.length, 5);
});

test('rejects empty mappings, unmatched accounts, and invalid balances without writes', async () => {
  for (const [mappings, data] of [
    [[], [account('missing')]],
    [[['known', 7]], [account('missing')]],
    [[['known', 7]], [account('known', NaN)]],
  ] as [unknown[][], ReturnType<typeof account>[]][]) {
    const { service, writes } = setup(mappings);
    await assert.rejects(service.updateSheet(data), /No accounts updated/);
    assert.equal(writes.length, 0);
  }
});

test('ignores blank mapping rows and includes mappings beyond the former row limit', async () => {
  const { service, writes } = setup([...Array.from({ length: 11 }, () => []), ['late', 20]]);
  await service.updateSheet([account('late')]);
  assert.equal(writes[0].range, 'Finance!F20');
});

test('skips headers and incomplete mappings while updating valid accounts', async () => {
  const { service, writes } = setup([
    ['Account ID', 'Row'], ['known', 7], ['broken', 'F8'], ['incomplete'], ['', 9],
  ]);
  await service.updateSheet([account('known'), account('broken')]);
  assert.deepEqual(writes.map(write => write.range), ['Finance!F7', 'Finance!J7']);
});

test('still rejects an update when every mapping is invalid', async () => {
  const { service, writes } = setup([['Account ID', 'Row'], ['known', 'F8']]);
  await assert.rejects(service.updateSheet([account('known')]), /No accounts updated/);
  assert.equal(writes.length, 0);
});

test('propagates write failures', async () => {
  const { service } = setup([['known', 7]]);
  (service as any).sheets.spreadsheets.values.update = async () => { throw new Error('write failed'); };
  await assert.rejects(service.updateSheet([account('known')]), /Failed to update Google Sheet: write failed/);
});
