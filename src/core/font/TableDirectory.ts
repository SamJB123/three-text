export interface TableDirectoryEntry {
  tag: number;
  checksum: number;
  offset: number;
  length: number;
}

// Parses the SFNT table directory for TTF/OTF fonts
// Assumes the DataView is positioned at the start of an sfnt font (offset 0)
// Table records are 16 bytes each starting at byte offset 12
export function parseTableDirectory(view: DataView): Map<number, TableDirectoryEntry> {
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


