/*
 * Jhadina Game Boy local-only ZIP importer.
 * Native browser deflate-raw, no CDN, no network, no third-party game data.
 * Strict limits to avoid archives writing paths or exhausting phone storage.
 */
(function (root) {
  'use strict';
  const MAX_ROM = 8 * 1024 * 1024;
  const MAX_ARCHIVE = 16 * 1024 * 1024;
  const MAX_ENTRIES = 64;
  const MAX_NAME = 512;
  const BAD_ZIP = 'Invalid Game Boy ZIP archive';
  function ensure(ok, reason) { if (!ok) throw new Error(reason); }
  function u16(b, i) {
    ensure(i >= 0 && i + 2 <= b.length, BAD_ZIP);
    return b[i] | (b[i + 1] << 8);
  }
  function u32(b, i) {
    ensure(i >= 0 && i + 4 <= b.length, BAD_ZIP);
    return (b[i] + b[i + 1] * 256 + b[i + 2] * 65536 + b[i + 3] * 16777216) >>> 0;
  }
  const TABLE = new Uint32Array(256);
  for (let i = 0; i < TABLE.length; i++) {
    let c = i;
    for (let bit = 0; bit < 8; bit++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    TABLE[i] = c >>> 0;
  }
  function crc32(bytes) {
    let c = 0xffffffff;
    for (const b of bytes) c = TABLE[(c ^ b) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  async function inflateRaw(bytes, expected) {
    ensure(typeof DecompressionStream === 'function',
      'This browser cannot unzip cartridges. Extract the ZIP in Files and select the .gb/.gbc file.');
    let stream;
    try {
      stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    } catch {
      throw new Error('Cannot extract this ZIP on this browser. Use iPhone Files to extract its .gb file.');
    }
    const reader = stream.getReader();
    const output = new Uint8Array(expected);
    let size = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        ensure(part.value && size + part.value.length <= expected,
          'ZIP extracted more data than declared. Import blocked.');
        output.set(part.value, size);
        size += part.value.length;
      }
    } catch (error) {
      try { await reader.cancel(); } catch {}
      throw error;
    } finally {
      try { reader.releaseLock(); } catch {}
    }
    ensure(size === expected, 'ZIP cartridge size did not match its directory.');
    return output;
  }
  function validName(name) {
    return name.length <= MAX_NAME &&
      !name.startsWith('/') && !name.startsWith('\\') &&
      !/^[a-z]:/i.test(name) &&
      !name.split(/[\\/]/).some(part => part === '..' || part === '') &&
      !name.includes('\0');
  }
  async function extractSingleGameBoyRom(file) {
    ensure(file && /\.zip$/i.test(file.name || ''),
      'Select a .zip archive containing one .gb or .gbc cartridge.');
    ensure(file.size >= 22 && file.size <= MAX_ARCHIVE,
      'ZIP must be between 22 bytes and 16 MB.');
    const b = new Uint8Array(await file.arrayBuffer());
    ensure(b.length === file.size, 'ZIP changed during import.');
    let end = -1;
    for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) {
      if (u32(b, i) === 0x06054b50 && i + 22 + u16(b, i + 20) === b.length) {
        end = i; break;
      }
    }
    ensure(end >= 0, 'ZIP central directory is missing or incomplete.');
    ensure(u16(b, end + 4) === 0 && u16(b, end + 6) === 0,
      'Multi-disk ZIP archives are not supported.');
    const count = u16(b, end + 10);
    ensure(count === u16(b, end + 8) && count > 0 && count <= MAX_ENTRIES,
      'ZIP must have 1 to 64 entries in a single archive.');
    const start = u32(b, end + 16), length = u32(b, end + 12);
    ensure(start !== 0xffffffff && length !== 0xffffffff &&
      start + length <= end, BAD_ZIP);
    let cursor = start, selected = null;
    for (let n = 0; n < count; n++) {
      ensure(cursor + 46 <= start + length && u32(b, cursor) === 0x02014b50, BAD_ZIP);
      const flags = u16(b, cursor + 8);
      const method = u16(b, cursor + 10);
      const checksum = u32(b, cursor + 16);
      const compressed = u32(b, cursor + 20);
      const uncompressed = u32(b, cursor + 24);
      const nameLength = u16(b, cursor + 28);
      const extraLength = u16(b, cursor + 30);
      const commentLength = u16(b, cursor + 32);
      const localOffset = u32(b, cursor + 42);
      const next = cursor + 46 + nameLength + extraLength + commentLength;
      ensure(next <= start + length && nameLength <= MAX_NAME, BAD_ZIP);
      const name = new TextDecoder('utf-8', {fatal:true})
        .decode(b.subarray(cursor + 46, cursor + 46 + nameLength));
      if (/\.(gb|gbc)$/i.test(name)) {
        ensure(selected === null, 'ZIP contains multiple Game Boy files. Extract one in Files.');
        ensure(validName(name), 'Unsafe cartridge filename in ZIP.');
        ensure((flags & 1) === 0 && (flags & 64) === 0,
          'Encrypted ZIP archives cannot be imported.');
        ensure(method === 0 || method === 8,
          'ZIP uses unsupported compression; extract it using Files.');
        ensure(uncompressed >= 0x150 && uncompressed <= MAX_ROM,
          'Game Boy cartridge inside ZIP must be 336 bytes to 8 MB.');
        ensure(compressed <= MAX_ARCHIVE && localOffset < start,
          'ZIP cartridge offset or size is invalid.');
        selected = {name, flags, method, checksum, compressed, uncompressed, localOffset};
      }
      cursor = next;
    }
    ensure(cursor === start + length, BAD_ZIP);
    ensure(selected, 'No .gb or .gbc cartridge was found in this ZIP.');
    const e = selected;
    const loc = e.localOffset;
    ensure(loc + 30 <= start && u32(b, loc) === 0x04034b50, BAD_ZIP);
    const localFlags = u16(b, loc + 6), localMethod = u16(b, loc + 8);
    const localNameLen = u16(b, loc + 26), localExtraLen = u16(b, loc + 28);
    ensure(localMethod === e.method && (localFlags & 1) === 0, BAD_ZIP);
    const dataStart = loc + 30 + localNameLen + localExtraLen;
    ensure(dataStart <= start && dataStart + e.compressed <= start, BAD_ZIP);
    const data = b.subarray(dataStart, dataStart + e.compressed);
    const bytes = e.method === 0 ? data.slice() : await inflateRaw(data, e.uncompressed);
    ensure(bytes.length === e.uncompressed && crc32(bytes) === e.checksum,
      'ZIP integrity failed: cartridge checksum does not match.');
    const fileName = e.name.split(/[\\/]/).pop();
    return {name:fileName, bytes};
  }
  root.JhadinaGameBoyZip = Object.freeze({extractSingleGameBoyRom});
})(globalThis);
