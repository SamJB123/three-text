export interface TableDirectoryEntry {
  tag: number;
  checksum: number;
  offset: number;
  length: number;
}

// SFNT table directory
export function parseTableDirectory(
  view: DataView
): Map<number, TableDirectoryEntry> {
  const numTables = view.getUint16(4);
  const tableRecordsStart = 12;

  const tables = new Map<number, TableDirectoryEntry>();

  for (let i = 0; i < numTables; i++) {
    const recordOffset = tableRecordsStart + i * 16;

    // Guard against corrupt buffers that report more tables than exist
    if (recordOffset + 16 > view.byteLength) {
      break;
    }

    const tag = view.getUint32(recordOffset);
    const checksum = view.getUint32(recordOffset + 4);
    const offset = view.getUint32(recordOffset + 8);
    const length = view.getUint32(recordOffset + 12);

    tables.set(tag, { tag, checksum, offset, length });
  }

  return tables;
}
