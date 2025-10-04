# Smart Sheet Selection Feature

## Overview
The AI now intelligently handles sheet selection when creating tables, allowing users to work with multiple sheets seamlessly.

## How It Works

### 1. **Automatic Sheet Detection**
When you specify a sheet in your request, the AI creates the table there immediately:

**Examples:**
- ✅ "create a table in Sheet1" → Creates in Sheet1
- ✅ "create product table in sheet26" → Creates in sheet26
- ✅ "make a table in new sheet called Sales" → Creates new sheet "Sales"

### 2. **Smart Clarification**
When you DON'T specify a sheet, the AI asks which one to use:

**Conversation Flow:**
```
You: "create a product table with 10 rows"

AI: "I'll create a table with headers: product, price, quantity, category 
     and 10 rows.

     Which sheet would you like to use?

     Existing sheets: "Sheet1", "sheet26"

     You can:
     - Choose an existing sheet (e.g., "use Sheet1")
     - Create a new sheet (e.g., "create new sheet called MyData")

     What would you prefer?"

You: "use Sheet1"  OR  "create new sheet Sales"

AI: "✅ Successfully created a table..."
```

### 3. **Follow-up Response Detection**
The AI remembers your table specifications when asking for sheet selection:

- **Preserves headers** from your original request
- **Preserves row count** from your original request
- **Detects various response formats**

## Supported Response Formats

### For Existing Sheets:
- `"use Sheet1"`
- `"Sheet1"`
- `"select sheet26"`
- `"choose Sheet1"`

### For New Sheets:
- `"create new sheet called Sales"`
- `"new sheet Sales"`
- `"make sheet MyData"`
- `"new sheet"` (creates "NewSheet" by default)

### In Original Request:
- `"create table in Sheet2"`
- `"add table to sheet26"`
- `"make table on Sales sheet"`

## Features

### ✅ Lists All Existing Sheets
When asking for clarification, the AI shows all existing sheets in your spreadsheet.

### ✅ Creates New Sheets Automatically
If you specify a sheet that doesn't exist, it's created automatically.

### ✅ Smart Name Extraction
Handles multi-word sheet names:
- "My Sales Data"
- "Q4-2024"
- "Customer_List"

### ✅ Context Preservation
When asking for sheet selection, preserves:
- Table headers
- Number of rows
- All original specifications

## Technical Implementation

### New Functions Added:

**1. `internalGetSheetNames` (spreadsheets.ts)**
```typescript
// Returns array of all sheet names in a spreadsheet
Returns: ["Sheet1", "sheet26", "Sales"]
```

**2. Enhanced Sheet Detection Logic**
- Checks if sheet name is in message
- Queries existing sheets if not specified
- Asks user for clarification with sheet list
- Detects follow-up responses intelligently

### Sheet Data Structure:
```json
[
  {
    "name": "Sheet1",
    "rows": {...},
    "cols": {...}
  },
  {
    "name": "sheet26", 
    "rows": {...},
    "cols": {...}
  }
]
```

## Example Scenarios

### Scenario 1: Direct Sheet Specification
```
You: "create employee table in HR_Data sheet"
AI: ✅ Creates table directly in HR_Data sheet
```

### Scenario 2: Sheet Clarification
```
You: "create product table"
AI: "Which sheet? Existing: Sheet1, Sales. Or create new?"
You: "Sales"
AI: ✅ Creates table in Sales sheet
```

### Scenario 3: New Sheet Creation
```
You: "create customer table in new sheet Clients"
AI: ✅ Creates new "Clients" sheet with table
```

### Scenario 4: Multiple Operations
```
You: "create product table in Products sheet"
AI: ✅ Creates table in Products
You: "calculate sum of price"
AI: ✅ Adds calculation in Products sheet (same sheet)
```

## Benefits

1. **Multi-Sheet Support**: Work with multiple sheets seamlessly
2. **User Choice**: Control where tables are created
3. **Smart Defaults**: AI asks when unclear
4. **Context Aware**: Remembers your specifications
5. **Flexible Input**: Many ways to specify sheets

## Edge Cases Handled

✅ **Empty spreadsheet** → Creates Sheet1 automatically
✅ **Invalid sheet names** → Sanitizes and uses valid name
✅ **Duplicate sheet names** → Uses existing sheet
✅ **No sheet specified** → Asks user for clarification
✅ **Follow-up responses** → Extracts sheet name intelligently

## Testing Recommendations

Test these scenarios:
1. Create table without specifying sheet (should ask)
2. Create table "in Sheet1" (should create directly)
3. Create table "in new sheet Sales" (should create new sheet)
4. Respond to clarification with "use Sheet1"
5. Respond to clarification with "new sheet MyData"
6. Create multiple tables in different sheets
7. Perform calculations in specific sheets

## Code Locations

**Main Logic:**
- `convex/aiAgents.ts` (lines ~480-650)
- `convex/ai.ts` (lines ~940-1092)

**Helper Functions:**
- `convex/spreadsheets.ts` → `internalGetSheetNames`
- `convex/spreadsheets.ts` → `internalCreateTableWithSpec`

## Future Enhancements (Optional)

Consider adding:
- Sheet deletion
- Sheet renaming
- Sheet reordering
- Copy/move tables between sheets
- Sheet templates
- Default sheet preference

## Conclusion

Users can now work with multiple sheets naturally through conversation. The AI intelligently detects sheet names, asks for clarification when needed, and preserves context throughout the interaction.

