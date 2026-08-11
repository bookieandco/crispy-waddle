import assert from 'node:assert/strict';
import test from 'node:test';
import { readBitaxeTelemetry, type BitaxeHttpClient } from '../src/bitaxe.ts';

test('maps AxeOS system info into read-only telemetry', async () => {
  const requests: string[] = [];
  const client: BitaxeHttpClient = {
    async getJson(url) {
      requests.push(url);
      return {
        hostname: 'bitaxe-01',
        ipv4: '192.168.1.42',
        macAddr: 'AA:BB:CC:DD:EE:FF',
        axeOSVersion: 'v2.12.0',
        boardVersion: '602',
        ASICModel: 'BM1370',
        hashRate: 475,
        hashRate_1m: 476,
        hashRate_10m: 477,
        hashRate_1h: 478,
        expectedHashrate: 470,
        power: 11.67,
        temp: 60,
        vrTemp: 45,
        fanrpm: 3583,
        fanspeed: 50,
        frequency: 485,
        actualFrequency: 485,
        voltage: 5208.75,
        current: 2237.5,
        sharesAccepted: 101,
        sharesRejected: 2,
        sharesPending: 1,
        uptimeSeconds: 900,
        stratumURL: 'pool.example',
        stratumPort: 3333,
        stratumUser: 'bc1qexample.worker',
        networkDifficulty: 123,
        blockHeight: 900000,
        blockFound: 0,
        miningPaused: false,
      };
    },
  };

  const telemetry = await readBitaxeTelemetry(client, {
    resourceId: 'bitaxe-01',
    baseUrl: 'http://192.168.1.42/',
  });

  assert.deepEqual(requests, ['http://192.168.1.42/api/system/info']);
  assert.equal(telemetry.reachable, true);
  assert.equal(telemetry.hashRateGh, 475);
  assert.equal(telemetry.powerWatts, 11.67);
  assert.equal(telemetry.temperatureC, 60);
  assert.equal(telemetry.asicModel, 'BM1370');
  assert.equal(telemetry.sharesAccepted, 101);
});

test('rejects non-http Bitaxe endpoints', async () => {
  const client: BitaxeHttpClient = { async getJson() { throw new Error('should not be called'); } };
  await assert.rejects(
    () => readBitaxeTelemetry(client, { resourceId: 'bad', baseUrl: 'ftp://bitaxe.local' }),
    /INVALID_BITAXE_URL/,
  );
});
