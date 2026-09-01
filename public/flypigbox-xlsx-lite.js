/* HUIDI XLSX Lite Reader — local multi-sheet reader for modern browsers.
   Keeps Excel upload independent from third-party CDN availability.
   R1.3A.18.20 adds workbook sheet discovery and selected-sheet reading. */
(() => {
  'use strict';

  const VERSION = 'V3.3.6.24-R1.3A.18.20';
  const decoder = new TextDecoder('utf-8');
  const cleanCell = value => String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  function u16(view, offset) { return view.getUint16(offset, true); }
  function u32(view, offset) { return view.getUint32(offset, true); }

  function findEocd(view) {
    const min = Math.max(0, view.byteLength - 0x10000 - 22);
    for (let i = view.byteLength - 22; i >= min; i -= 1) {
      if (u32(view, i) === 0x06054b50) return i;
    }
    throw new Error('不是有效的 XLSX 文件。');
  }

  async function inflateRaw(bytes) {
    if (typeof DecompressionStream !== 'function') throw new Error('当前浏览器不支持本地 Excel 解压。');
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function unzip(arrayBuffer) {
    const view = new DataView(arrayBuffer);
    const eocd = findEocd(view);
    const entries = u16(view, eocd + 10);
    let cursor = u32(view, eocd + 16);
    const result = new Map();

    for (let index = 0; index < entries; index += 1) {
      if (u32(view, cursor) !== 0x02014b50) throw new Error('XLSX 压缩目录损坏。');
      const method = u16(view, cursor + 10);
      const compressedSize = u32(view, cursor + 20);
      const filenameLength = u16(view, cursor + 28);
      const extraLength = u16(view, cursor + 30);
      const commentLength = u16(view, cursor + 32);
      const localOffset = u32(view, cursor + 42);
      const filename = decoder.decode(new Uint8Array(arrayBuffer, cursor + 46, filenameLength));

      if (u32(view, localOffset) !== 0x04034b50) throw new Error('XLSX 文件项损坏。');
      const localFilenameLength = u16(view, localOffset + 26);
      const localExtraLength = u16(view, localOffset + 28);
      const dataStart = localOffset + 30 + localFilenameLength + localExtraLength;
      const compressed = new Uint8Array(arrayBuffer, dataStart, compressedSize);
      let data;
      if (method === 0) data = new Uint8Array(compressed);
      else if (method === 8) data = await inflateRaw(compressed);
      else throw new Error(`暂不支持的 XLSX 压缩方式：${method}`);
      result.set(filename.replace(/^\/+/, ''), data);
      cursor += 46 + filenameLength + extraLength + commentLength;
    }
    return result;
  }

  function xml(entries, path) {
    const bytes = entries.get(path);
    if (!bytes) return null;
    return new DOMParser().parseFromString(decoder.decode(bytes), 'application/xml');
  }

  function colIndex(ref) {
    const letters = String(ref || '').match(/^[A-Z]+/i)?.[0] || 'A';
    let value = 0;
    for (const ch of letters.toUpperCase()) value = value * 26 + ch.charCodeAt(0) - 64;
    return Math.max(0, value - 1);
  }

  function resolveTarget(base, target) {
    if (!target) return '';
    if (target.startsWith('/')) return target.slice(1);
    const stack = base.split('/').slice(0, -1);
    target.split('/').forEach(part => {
      if (!part || part === '.') return;
      if (part === '..') stack.pop();
      else stack.push(part);
    });
    return stack.join('/');
  }

  function sharedStrings(entries) {
    const doc = xml(entries, 'xl/sharedStrings.xml');
    if (!doc) return [];
    return Array.from(doc.getElementsByTagName('si')).map(si =>
      Array.from(si.getElementsByTagName('t')).map(node => node.textContent || '').join('')
    );
  }

  function sheetPaths(entries) {
    const workbook = xml(entries, 'xl/workbook.xml');
    const rels = xml(entries, 'xl/_rels/workbook.xml.rels');
    if (!workbook || !rels) return [{ name: 'Sheet1', path: 'xl/worksheets/sheet1.xml' }];
    const relMap = new Map(Array.from(rels.getElementsByTagName('Relationship')).map(node => [node.getAttribute('Id'), node.getAttribute('Target')]));
    const sheets = Array.from(workbook.getElementsByTagName('sheet')).map((sheet, index) => {
      const rid = sheet.getAttribute('r:id') || sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
      const target = relMap.get(rid) || `worksheets/sheet${index + 1}.xml`;
      return { name: sheet.getAttribute('name') || `Sheet${index + 1}`, path: resolveTarget('xl/workbook.xml', target) };
    });
    return sheets.length ? sheets : [{ name: 'Sheet1', path: 'xl/worksheets/sheet1.xml' }];
  }

  function parseSheet(entries, path, shared) {
    const doc = xml(entries, path);
    if (!doc) throw new Error('Excel 工作表无法读取。');
    const rows = [];
    Array.from(doc.getElementsByTagName('row')).forEach(rowNode => {
      const rowNumber = Math.max(1, Number(rowNode.getAttribute('r') || rows.length + 1));
      const row = rows[rowNumber - 1] || [];
      Array.from(rowNode.getElementsByTagName('c')).forEach(cell => {
        const ref = cell.getAttribute('r') || 'A1';
        const type = cell.getAttribute('t') || '';
        const index = colIndex(ref);
        let value = '';
        if (type === 'inlineStr') {
          value = Array.from(cell.getElementsByTagName('t')).map(node => node.textContent || '').join('');
        } else {
          const raw = cell.getElementsByTagName('v')[0]?.textContent || '';
          if (type === 's') value = shared[Number(raw)] ?? '';
          else if (type === 'b') value = raw === '1' ? 'TRUE' : 'FALSE';
          else value = raw;
        }
        row[index] = cleanCell(value);
      });
      rows[rowNumber - 1] = row;
    });
    const width = rows.reduce((max, row) => Math.max(max, row?.length || 0), 0);
    return rows.map(row => Array.from({ length: width }, (_, i) => cleanCell(row?.[i] || '')));
  }

  async function readFile(file) {
    const entries = await unzip(await file.arrayBuffer());
    const shared = sharedStrings(entries);
    const descriptors = sheetPaths(entries);
    const sheets = descriptors.map(item => ({ name: item.name, matrix: parseSheet(entries, item.path, shared) }));
    const first = sheets[0] || { name: 'Sheet1', matrix: [] };
    return { version: VERSION, sheetName: first.name, matrix: first.matrix, sheets };
  }

  function matrixToText(matrix) {
    return (matrix || []).map(row => (row || []).map(cleanCell).join('\t')).join('\n');
  }

  window.FlypigBOXXlsxLite = { version: VERSION, readFile, matrixToText, cleanCell };
})();
