import { NextRequest, NextResponse } from 'next/server';

/**
 * Fallback function to detect tables programmatically from text
 * Uses smart pattern matching for better accuracy with multi-word values
 * Handles multi-page tables by combining them into one
 */
function detectTablesFromText(text: string): any[] {
  const tables: any[] = [];
  
  console.log("🔍 Fallback parser starting...");
  console.log("   Text length:", text.length);
  
  // Split text by page markers if they exist
  const pages = text.split(/=== PAGE \d+ ===/);
  console.log("   Pages found:", pages.length);
  
  // First pass: Find the header on the first page with data
  let headers: string[] = [];
  let headerFound = false;
  let allDataLines: string[] = [];
  
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    const pageText = pages[pageIndex].trim();
    if (!pageText) continue;
    
    const lines = pageText.split('\n').filter(line => line.trim().length > 0);
    console.log(`   Page ${pageIndex + 1}: ${lines.length} lines`);
    
    if (lines.length === 0) continue;
    
    // Only look for header on first page with data
    if (!headerFound) {
      for (let i = 0; i < Math.min(5, lines.length); i++) {
        const line = lines[i];
        const words = line.split(/\s+/);
        
        const hasHeaderPattern = words.some(w => 
          /^[A-Z]/.test(w) || 
          w.includes('(') ||
          /ID|Name|Date|Type|Status|Amount|Price|Location|Device|Feature|Duration|User/i.test(w)
        );
        
        if (hasHeaderPattern && words.length >= 3 && words.length <= 20) {
          // Split header by 2+ spaces
          headers = line.split(/\s{2,}/).filter(h => h.trim());
          
          if (headers.length >= 2) {
            headerFound = true;
            console.log(`   ✓ Header found on page ${pageIndex + 1}, line ${i}: "${line}"`);
            console.log(`   ✓ Headers: ${headers.length} columns - ${headers.join(", ")}`);
            
            // Add data lines from this page (after header)
            allDataLines.push(...lines.slice(i + 1));
            break;
          }
        }
      }
      
      if (!headerFound) {
        // No header found, try first line as header
        const firstLine = lines[0];
        headers = firstLine.split(/\s{2,}/).filter(h => h.trim());
        if (headers.length >= 2) {
          headerFound = true;
          console.log(`   ✓ Using first line as header: ${headers.join(", ")}`);
          allDataLines.push(...lines.slice(1));
        }
      }
    } else {
      // Header already found, just add all lines from this page as data
      console.log(`   ➕ Adding ${lines.length} data lines from page ${pageIndex + 1}`);
      allDataLines.push(...lines);
    }
  }
  
  if (!headerFound || headers.length < 2) {
    console.log("   ✗ No valid header found");
    return tables;
  }
  
  console.log(`   📊 Total data lines collected: ${allDataLines.length}`);
  console.log(`   🔄 Combining all pages into ONE continuous table`);
  
  const rows: string[][] = [headers];
  
  // Smart parsing: Use regex patterns to identify column values
  for (const line of allDataLines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    
    // Strategy: Split by 2+ spaces first
    let parts = trimmedLine.split(/\s{2,}/);
    
    // If we get exactly the right number of columns, use it
    if (parts.length === headers.length) {
      rows.push(parts.map(p => p.trim()));
      continue;
    }
    
    // If not, try smarter parsing based on patterns
    const tokens = trimmedLine.split(/\s+/);
    
    if (tokens.length >= headers.length) {
      const rowData: string[] = [];
      let tokenIdx = 0;
      
      for (let colIdx = 0; colIdx < headers.length; colIdx++) {
        if (tokenIdx >= tokens.length) {
          rowData.push("");
          continue;
        }
        
        const header = headers[colIdx].toLowerCase();
        
        // Column-specific parsing rules
        if (header.includes('id') || header.includes('user')) {
          // Single token (e.g., U1234)
          rowData.push(tokens[tokenIdx++]);
        } else if (header.includes('date')) {
          // Date format YYYY-MM-DD (single token)
          rowData.push(tokens[tokenIdx++]);
        } else if (header.includes('duration') || header.includes('mins')) {
          // Number (possibly with decimal)
          rowData.push(tokens[tokenIdx++]);
        } else if (header.includes('device')) {
          // Single word: Android, iOS, Web
          rowData.push(tokens[tokenIdx++]);
        } else if (header.includes('location')) {
          // Country name (rest of tokens if last column, otherwise single)
          if (colIdx === headers.length - 1) {
            // Last column - take remaining tokens
            rowData.push(tokens.slice(tokenIdx).join(' '));
            tokenIdx = tokens.length;
          } else {
            rowData.push(tokens[tokenIdx++]);
          }
        } else if (header.includes('feature') || header.includes('used')) {
          // Feature can be 1-2 words: "Reports", "API Access", "User Management"
          let feature = tokens[tokenIdx++];
          
          // Check if next token is lowercase or part of known multi-word features
          if (tokenIdx < tokens.length) {
            const nextToken = tokens[tokenIdx];
            // If next token starts with lowercase or is a known continuation word
            if (/^[a-z]/.test(nextToken) || ['Access', 'Management'].includes(nextToken)) {
              feature += ' ' + tokens[tokenIdx++];
            }
          }
          
          rowData.push(feature);
        } else {
          // Default: take next token
          rowData.push(tokens[tokenIdx++]);
        }
      }
      
      // Ensure row has correct length
      while (rowData.length < headers.length) {
        rowData.push("");
      }
      
      rows.push(rowData);
    } else {
      // Fallback: just split by spaces and group to match header count
      const rowData: string[] = [];
      const tokensPerCol = Math.floor(tokens.length / headers.length);
      
      for (let colIdx = 0; colIdx < headers.length; colIdx++) {
        if (colIdx === headers.length - 1) {
          // Last column gets remaining tokens
          const remaining = tokens.slice(colIdx * tokensPerCol);
          rowData.push(remaining.join(' '));
        } else {
          const start = colIdx * tokensPerCol;
          const end = start + tokensPerCol;
          rowData.push(tokens.slice(start, end).join(' '));
        }
      }
      
      rows.push(rowData);
    }
  }
  
  console.log(`   ✅ Parsed ${rows.length - 1} total data rows`);
  
  // Create single table with all data
  if (rows.length >= 4) {
    tables.push({
      page: 1, // All pages combined into one table
      rows: rows
    });
    
    console.log(`✅ Fallback parser SUCCESS!`);
    console.log(`   📊 SINGLE CONTINUOUS TABLE (all pages combined)`);
    console.log(`   Table: ${headers.length} columns × ${rows.length - 1} rows`);
    console.log(`   Headers: ${headers.join(" | ")}`);
    console.log(`   Sample row 1: ${rows[1].join(" | ")}`);
    if (rows.length > 2) {
      console.log(`   Sample row 2: ${rows[2].join(" | ")}`);
    }
    if (rows.length > 3) {
      console.log(`   Sample row 3: ${rows[3].join(" | ")}`);
    }
  } else {
    console.log(`   ✗ Not enough rows (${rows.length - 1} data rows, need 3+)`);
  }
  
  console.log(`🏁 Fallback parser complete. Found ${tables.length} table(s)`);
  if (tables.length > 0) {
    console.log(`   ℹ️  Note: Multi-page tables are combined into ONE table`);
  }
  return tables;
}

export async function POST(request: NextRequest) {
  console.log("\n" + "=".repeat(80));
  console.log("🚀 TABLE EXTRACTION API CALLED");
  console.log("=".repeat(80));
  
  try {
    const { text } = await request.json();
    console.log("📄 Request received:");
    console.log("  - Text length:", text?.length || 0);
    console.log("  - Text preview:", text?.substring(0, 200) || "NO TEXT");

    if (!text) {
      console.error("❌ No text provided in request");
      return NextResponse.json(
        { error: 'No text provided' },
        { status: 400 }
      );
    }
    
    console.log("✓ Text validation passed");


    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      console.error("OpenAI API key not configured");
      return NextResponse.json(
        { error: 'OpenAI API key not configured', tables: [] },
        { status: 200 }
      );
    }

    // Use GPT-4o for better table extraction (more capable than mini)
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert at extracting tables from documents. Your task is to identify and extract ALL tabular data.

CRITICAL: You MUST extract tables even if they are:
- Space-separated columns (most common in PDFs)
- Tab-separated values
- Column-aligned text with consistent spacing
- Lists with repeating structure

HOW TO IDENTIFY TABLES:
1. Look for a header row (column names at the top)
2. Look for multiple rows of data below with the same structure
3. Columns are often separated by multiple spaces
4. Data aligns vertically under headers

EXAMPLE INPUT:
UserID   Date   FeatureUsed   Duration(mins)
U1084   2025-10-07 Reports   59.1
U1025   2025-10-07 API Access   4.2

REQUIRED OUTPUT FORMAT:
[{"page": 1, "rows": [["UserID", "Date", "FeatureUsed", "Duration(mins)"], ["U1084", "2025-10-07", "Reports", "59.1"], ["U1025", "2025-10-07", "API Access", "4.2"]]}]

STRICT RULES:
- Return ONLY valid JSON - no markdown, no explanations, no extra text
- First row MUST be headers
- Parse space-separated columns carefully
- Include ALL data rows
- If a cell is empty, use ""
- If multiple tables exist, include all of them in the array
- If absolutely no tables exist, return: []

WARNING: Do NOT return empty array if there IS tabular data. Most PDF tables are space-separated!`
          },
          {
            role: "user",
            content: `Extract ALL tables from this text. Look carefully for space-separated columns with headers at the top.

${text}

Return ONLY the JSON array. No explanations. No markdown formatting.`
          }
        ],
        temperature: 0.1,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("=".repeat(60));
      console.error("❌ OpenAI API error:", response.status);
      console.error(errorText);
      console.error("=".repeat(60));
      console.log("🔄 Using fallback parser due to API error...");
      
      // Use fallback when API fails (process full text)
      const fallbackTables = detectTablesFromText(text);
      
      if (fallbackTables.length > 0) {
        console.log("=".repeat(60));
        console.log(`✅ FALLBACK SUCCESS: Detected ${fallbackTables.length} table(s)`);
        console.log("=".repeat(60));
        return NextResponse.json({ tables: fallbackTables });
      }
      
      console.error("=".repeat(60));
      console.error("❌ FALLBACK ALSO FAILED");
      console.error("=".repeat(60));
      return NextResponse.json(
        { error: 'Table extraction failed', tables: [] },
        { status: 200 }
      );
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || "[]";
    
    console.log("=".repeat(60));
    console.log("📊 TABLE EXTRACTION API RESPONSE");
    console.log("=".repeat(60));
    console.log("Raw AI response (first 500 chars):", content.substring(0, 500));
    console.log("Full response length:", content.length);
    
    // Extract JSON from response (handle markdown code blocks and extra text)
    let jsonStr = content.trim();
    
    // Remove markdown code blocks
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.slice(7);
    } else if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.slice(3);
    }
    
    if (jsonStr.endsWith("```")) {
      jsonStr = jsonStr.slice(0, -3);
    }
    
    jsonStr = jsonStr.trim();
    
    // Try to find JSON array in the response
    const arrayMatch = jsonStr.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (arrayMatch) {
      jsonStr = arrayMatch[0];
    }
    
    let tables = [];
    try {
      tables = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      console.error("Attempted to parse:", jsonStr.substring(0, 500));
      // Return empty array if parsing fails
      return NextResponse.json({ tables: [] });
    }
    
    // Validate and clean tables
    if (Array.isArray(tables)) {
      tables = tables.filter(table => {
        return table.rows && 
               Array.isArray(table.rows) && 
               table.rows.length > 1 && // At least header + 1 data row
               table.rows[0].length > 0; // Header row has columns
      });
      
      // Ensure all rows have the same number of columns as the header
      tables = tables.map(table => {
        const headerLength = table.rows[0].length;
        return {
          ...table,
          rows: table.rows.map((row: any[]) => {
            if (row.length < headerLength) {
              // Pad with empty strings
              return [...row, ...Array(headerLength - row.length).fill("")];
            } else if (row.length > headerLength) {
              // Truncate
              return row.slice(0, headerLength);
            }
            return row;
          })
        };
      });
      
      console.log(`Successfully extracted ${tables.length} table(s)`);
      tables.forEach((table, idx) => {
        console.log(`Table ${idx + 1}: ${table.rows[0].length} columns, ${table.rows.length - 1} data rows`);
        console.log(`  Headers: ${table.rows[0].join(", ")}`);
      });
    } else {
      console.warn("AI response was not an array:", tables);
      tables = [];
    }
    
    // FALLBACK: If AI returned empty array, try to detect tables programmatically
    if (tables.length === 0) {
      console.log("=".repeat(60));
      console.log("⚠️  AI RETURNED EMPTY ARRAY - ACTIVATING FALLBACK PARSER");
      console.log("=".repeat(60));
      const fallbackTables = detectTablesFromText(text);
      if (fallbackTables.length > 0) {
        console.log("=".repeat(60));
        console.log(`✅ FALLBACK SUCCESS: Detected ${fallbackTables.length} table(s)`);
        console.log("=".repeat(60));
        tables = fallbackTables;
      } else {
        console.log("=".repeat(60));
        console.log("❌ FALLBACK FAILED: No tables detected");
        console.log("=".repeat(60));
      }
    } else {
      console.log("=".repeat(60));
      console.log(`✅ AI SUCCESS: Detected ${tables.length} table(s)`);
      console.log("=".repeat(60));
    }
    
    console.log("=".repeat(60));
    console.log("📋 FINAL RESULT");
    console.log("=".repeat(60));
    console.log(`Total tables to return: ${tables.length}`);
    if (tables.length > 0) {
      tables.forEach((table, idx) => {
        console.log(`Table ${idx + 1}:`);
        console.log(`  - Columns: ${table.rows[0].length}`);
        console.log(`  - Data rows: ${table.rows.length - 1}`);
        console.log(`  - Headers: ${table.rows[0].join(", ")}`);
      });
    }
    console.log("=".repeat(60));
    
    return NextResponse.json({
      tables: tables,
    });
  } catch (error) {
    console.error("Error in table extraction:", error);
    return NextResponse.json(
      { error: 'Internal error', tables: [] },
      { status: 200 }
    );
  }
}

