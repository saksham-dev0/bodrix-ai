// Test script for table parser
// Run with: node test-table-parser.js

const testText = `
=== PAGE 1 ===
UserID   Date   FeatureUsed   Duration(mins)   Device   Location
U1084   2025-10-07 Reports   59.1 Android   Germany
U1025   2025-10-07 API Access   4.2 Web   India
U1112   2025-10-07 Reports   13.1 iOS   Canada
U1025   2025-10-07 Dashboard   56.8 Web   Australia
U1134   2025-10-07 API Access   46.3 Web   Australia
`;

function detectTablesFromText(text) {
  const tables = [];
  
  console.log("🔍 Fallback parser starting...");
  console.log("   Text length:", text.length);
  
  // Split text by page markers
  const pages = text.split(/=== PAGE \d+ ===/);
  console.log("   Pages found:", pages.length);
  console.log("   Pages content:", pages.map((p, i) => `Page ${i}: "${p.substring(0, 50)}..."`));
  
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    const pageText = pages[pageIndex].trim();
    console.log(`\n📄 Processing page ${pageIndex}:`);
    console.log(`   Page text length: ${pageText.length}`);
    console.log(`   Page text: "${pageText.substring(0, 100)}..."`);
    
    if (!pageText) {
      console.log("   ⚠️  Skipping empty page");
      continue;
    }
    
    const lines = pageText.split('\n').filter(line => line.length > 0);
    console.log(`   Lines found: ${lines.length}`);
    
    if (lines.length < 2) {
      console.log("   ⚠️  Not enough lines");
      continue;
    }
    
    // Detect header line
    let headerLineIndex = -1;
    let headerLine = '';
    
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i];
      console.log(`   Checking line ${i}: "${line}"`);
      
      const words = line.split(/\s+/);
      console.log(`     Words: ${words.length} - ${words.join(", ")}`);
      
      const hasHeaderPattern = words.some(w => 
        /^[A-Z]/.test(w) || 
        w.includes('(') ||
        /ID|Name|Date|Type|Status|Amount|Price|Location|Device|Feature|Duration|User/i.test(w)
      );
      
      console.log(`     Has header pattern: ${hasHeaderPattern}`);
      
      if (hasHeaderPattern && words.length >= 3 && words.length <= 20) {
        headerLineIndex = i;
        headerLine = line;
        console.log(`   ✓ Header found at line ${i}: "${line}"`);
        break;
      }
    }
    
    if (headerLineIndex === -1) {
      console.log(`   ✗ No header found`);
      continue;
    }
    
    // Split header by 2+ spaces
    const headerParts = headerLine.split(/\s{2,}/);
    console.log(`   Header parts (split by 2+ spaces): ${headerParts.length}`);
    console.log(`   Headers:`, headerParts);
    
    if (headerParts.length < 2) {
      console.log(`   ✗ Not enough columns (${headerParts.length})`);
      continue;
    }
    
    // Calculate header positions
    const headerPositions = [];
    let searchStart = 0;
    
    for (const part of headerParts) {
      const pos = headerLine.indexOf(part, searchStart);
      if (pos >= 0) {
        headerPositions.push({
          text: part,
          start: pos,
          end: pos + part.length
        });
        searchStart = pos + part.length;
      }
    }
    
    console.log(`   Column positions:`);
    headerPositions.forEach(h => console.log(`     ${h.text} @ position ${h.start}`));
    
    const headers = headerPositions.map(h => h.text);
    const rows = [headers];
    
    // Parse data rows
    console.log(`\n   Parsing data rows...`);
    for (let i = headerLineIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      console.log(`   Row ${i}: "${line}"`);
      
      const rowParts = [];
      
      for (let colIdx = 0; colIdx < headerPositions.length; colIdx++) {
        const header = headerPositions[colIdx];
        const nextHeader = headerPositions[colIdx + 1];
        
        let cellValue;
        if (nextHeader) {
          cellValue = line.substring(header.start, nextHeader.start).trim();
        } else {
          cellValue = line.substring(header.start).trim();
        }
        
        rowParts.push(cellValue);
      }
      
      console.log(`     Extracted: [${rowParts.join(" | ")}]`);
      
      if (rowParts.some(cell => cell.length > 0)) {
        rows.push(rowParts);
      }
    }
    
    console.log(`\n   Total rows parsed: ${rows.length - 1} data rows`);
    
    if (rows.length >= 4) {
      tables.push({
        page: pageIndex + 1,
        rows: rows
      });
      
      console.log(`\n✅ Table created successfully!`);
      console.log(`   ${headers.length} columns × ${rows.length - 1} rows`);
      console.log(`   Headers: ${headers.join(", ")}`);
    } else {
      console.log(`\n✗ Not enough rows (${rows.length - 1}, need 3+)`);
    }
  }
  
  console.log(`\n🏁 Parser complete. Found ${tables.length} table(s)`);
  return tables;
}

// Run test
console.log("🧪 TESTING TABLE PARSER\n");
const result = detectTablesFromText(testText);

console.log("\n" + "=".repeat(60));
console.log("FINAL RESULT:");
console.log("=".repeat(60));
console.log(JSON.stringify(result, null, 2));

