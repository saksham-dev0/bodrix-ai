# Sheet Name Parsing Fix

## Problem
When users asked the AI to create charts with prompts like "create pie chart for UserID and Amount in sheet name transactions", the AI was failing with the error:
```
Failed to create chart: Sheet "name transactions" not found. Please make sure the columns and sheet name are correct.
```

Even though the sheet existed (e.g., "transactions - trans"), the AI couldn't find it because:
1. The regex patterns were incorrectly parsing "sheet name transactions" and extracting "name" or just part of the sheet name
2. The AI was using exact string matching instead of fuzzy matching
3. No fallback logic existed to find similar sheet names

## Solution Overview
Implemented intelligent sheet name parsing and fuzzy matching in three files:
1. **convex/ai.ts** - Enhanced AI chart creation logic
2. **src/components/ChartJSFromRange.tsx** - Improved chart rendering component
3. **convex/ai.ts** (test data generation) - Updated test data creation logic

## Changes Made

### 1. Enhanced Sheet Name Extraction (convex/ai.ts)

#### Chart Creation (lines 1706-1807)
**Before:**
- Used simple regex patterns that couldn't handle "sheet name X" syntax
- Captured partial or incorrect sheet names (e.g., "name" instead of "transactions")
- No validation against actual available sheets

**After:**
- Fetches available sheets from the database first
- Uses improved regex patterns that handle multiple syntaxes:
  - "in sheet name X"
  - "in sheet X"
  - "sheet named X"
  - "sheet called X"
  - Quoted names: "X"
- Implements multi-level fuzzy matching:
  1. **Exact match** (case-insensitive): `"Transactions" === "transactions"`
  2. **Partial match**: `"transactions - trans"` contains `"transactions"`
  3. **Word-based match**: All words in user input appear in sheet name
- Falls back to active sheet or first sheet if no match found
- Comprehensive logging for debugging

**Example Matching:**
```typescript
User says: "sheet name transactions"
Extracted: "transactions"
Available sheets: ["transactions - trans", "Sheet1", "data"]
Match found: "transactions - trans" ✓
```

#### Test Data Generation (lines 1619-1648)
**Before:**
- Similar issues with "sheet name X" syntax
- Less robust pattern matching

**After:**
- Updated patterns to handle "sheet name X" syntax
- Cleans extracted names by removing trailing command words
- Better stop word filtering

### 2. Improved Error Messages (convex/ai.ts)

**Before:**
```
Failed to create chart: Sheet "name" not found. Please make sure the columns and sheet name are correct.
```

**After:**
```
Failed to create chart: Sheet "name" not found. Please use one of the available sheet names.

Available sheets: "transactions - trans", "Sheet1", "data"
```

Error messages now include:
- List of all available sheets
- Clear guidance on proper syntax
- Example prompts using actual sheet names

### 3. Enhanced Chart Rendering (src/components/ChartJSFromRange.tsx)

**Before:**
- Used exact string matching: `s.name === sheetName`
- No fallback if sheet not found
- Silent failures

**After:**
- Implements same fuzzy matching logic as AI:
  1. Exact match (case-insensitive)
  2. Partial match (contains or is contained by)
  3. Word-based match
- Console warnings with available sheet list
- More robust against sheet name changes

**Code:**
```typescript
// First try exact match (case insensitive)
let foundSheet = sheetData.find(s => s.name?.toLowerCase() === sheetName.toLowerCase());

// If no exact match, try partial match
if (!foundSheet) {
  foundSheet = sheetData.find(s => 
    s.name?.toLowerCase().includes(sheetName.toLowerCase()) || 
    sheetName.toLowerCase().includes(s.name?.toLowerCase() || '')
  );
}

// If still no match, try word-based matching
if (!foundSheet) {
  const sheetNameWords = sheetName.toLowerCase().split(/\s+/);
  foundSheet = sheetData.find(s => {
    const sName = s.name?.toLowerCase() || '';
    return sheetNameWords.every(word => sName.includes(word));
  });
}
```

## Testing Scenarios

The fix handles these user prompts correctly:

### 1. "sheet name" syntax
```
"create pie chart for UserID and Amount in sheet name transactions"
→ Finds "transactions - trans" ✓
```

### 2. Partial sheet names
```
"create bar chart of sales and profit in sheet trans"
→ Finds "transactions - trans" ✓
```

### 3. Case insensitive
```
"create line chart in SHEET NAME Transactions"
→ Finds "transactions - trans" ✓
```

### 4. Multiple words
```
"show chart in employee data sheet"
→ Finds "employee data" ✓
```

### 5. Exact matches still work
```
"create chart in transactions - trans"
→ Finds "transactions - trans" ✓
```

### 6. No sheet specified
```
"create chart for sales and profit"
→ Uses active sheet or first sheet ✓
```

## Benefits

1. **User-Friendly**: Users can use natural language without worrying about exact sheet names
2. **Robust**: Multiple fallback mechanisms ensure charts are created successfully
3. **Transparent**: Clear error messages and logging help diagnose issues
4. **Maintainable**: Centralized matching logic that's easy to extend
5. **No Breaking Changes**: Exact matches still work, new logic only adds flexibility

## Debug Logging

Added comprehensive console logging to help diagnose issues:
```typescript
console.log("Available sheets:", availableSheets);
console.log("User message:", args.userMessage);
console.log("Extracted sheet name from pattern:", extractedName);
console.log(`Matched sheet: "${extractedName}" -> "${sheetName}"`);
console.log("Using active sheet:", sheetName);
```

## Edge Cases Handled

1. **Sheet doesn't exist**: Clear error with available sheets list
2. **No sheets in spreadsheet**: Graceful error message
3. **Multiple partial matches**: Returns first match (predictable)
4. **Sheet name with special characters**: Handles hyphens, underscores, spaces
5. **Very similar names**: Word-based matching provides good differentiation
6. **Empty or whitespace-only names**: Filtered out from available sheets

## Migration Notes

- No database migrations needed
- No breaking changes to existing functionality
- Existing charts continue to work
- Users can immediately benefit from improved parsing

## Future Enhancements

Potential improvements for future iterations:
1. **Similarity scoring**: Use Levenshtein distance for better matches
2. **User confirmation**: Ask user to confirm when multiple close matches exist
3. **Sheet name suggestions**: Suggest closest matches when no match found
4. **Learning**: Remember user preferences for ambiguous cases
5. **Auto-correction**: Suggest corrections for common typos

