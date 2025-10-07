# Document Upload & AI Analysis Feature

## Overview
This feature allows users to upload PDF and DOCX files to the spreadsheet application. The AI can then:
- Answer questions about the uploaded documents
- Extract tables from documents and create them in the spreadsheet
- Analyze document content alongside spreadsheet data

## Features Implemented

### 1. **Database Schema**
- Added `documents` table to store uploaded file metadata
- Fields include:
  - `fileName`: Original file name
  - `fileType`: "pdf" or "docx"
  - `storageId`: Convex file storage reference
  - `extractedText`: Full text content from document
  - `extractedTables`: JSON array of detected tables
  - `processingStatus`: "pending", "processing", "completed", or "failed"
  - Links to spreadsheet and conversation

### 2. **File Upload System**
**File:** `convex/documents.ts`

**Mutations:**
- `generateUploadUrl()`: Generate secure upload URL for file
- `createDocument()`: Create document record after upload and schedule processing
- `listDocuments(spreadsheetId)`: List all documents for a spreadsheet
- `getDocument(documentId)`: Get single document details
- `deleteDocument(documentId)`: Delete document and file from storage

### 3. **Document Processing**
**File:** `convex/documents.ts`

**Actions:**
- `processDocument()`: Extract text and tables from uploaded files
  - For PDFs: Uses `pdfjs-dist` to extract text and detect tables
  - For DOCX: Uses `mammoth` to extract text and detect tables
  - Detects tables using heuristics (tabs, pipes, multiple spaces)
  - Stores extracted content in database

**Table Detection:**
- Looks for lines with multiple tabs (`\t`), pipes (`|`), or  spacing (3+ spaces)
- Parses rows and columns from detected table patterns
- Stores table structure with row/column data

### 4. **AI Integration**
**File:** `convex/ai.ts`

**Enhanced AI Context:**
- `buildAIContext()` now includes uploaded documents
- Shows document content (first 5000 chars)
- Displays all detected tables in markdown format
- AI can reference specific document content in responses

**New AI Capabilities:**
- **Document Q&A**: Ask questions about uploaded documents
  - "What's in the uploaded document?"
  - "Summarize the PDF"
  - "What data is in the document?"

- **Table Creation from Documents**:
  - "Create a table from the document"
  - "Create table from file in Sheet1"
  - "Make a table from the PDF"
  - Auto-detects tables in documents
  - Creates exact replica in spreadsheet with headers and data

### 5. **Spreadsheet Integration**
**File:** `convex/spreadsheets.ts`

**New Mutation:**
- `internalCreateTableFromDocument()`:
  - Takes headers and data rows from document
  - Creates table in specified sheet
  - Handles sheet creation if needed
  - Finds next available row automatically

## Usage

### 1. Upload a Document
```typescript
// Frontend code example
const uploadUrl = await generateUploadUrl();
const response = await fetch(uploadUrl, {
  method: "POST",
  body: fileBlob,
});
const { storageId } = await response.json();

await createDocument({
  spreadsheetId,
  conversationId,
  fileName: file.name,
  fileType: "pdf", // or "docx"
  storageId,
});
```

### 2. Ask AI About Document
```
User: "What information is in the uploaded PDF?"
AI: [Provides summary of document content]

User: "What tables are in the document?"
AI: [Lists tables found with preview]
```

### 3. Create Table from Document
```
User: "Create a table from the document in Sheet1"
AI: "I've successfully created a table from 'report.pdf' in sheet 
     'Sheet1' with 5 columns and 10 data rows."
```

## Dependencies Added

```json
{
  "dependencies": {
    "mammoth": "^1.8.0",
    "pdfjs-dist": "^4.0.379"
  },
  "devDependencies": {
    "@types/pdfjs-dist": "^2.10.378"
  }
}
```

## Installation Steps

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Regenerate Convex API types:**
   ```bash
   npx convex dev
   ```
   This will regenerate the `_generated/api.ts` file to include the new `documents` module.

3. **Deploy to Convex:**
   ```bash
   npx convex deploy
   ```

## API Reference

### Upload Flow
1. Client calls `generateUploadUrl()`
2. Client uploads file to returned URL
3. Client calls `createDocument()` with storage ID
4. Server schedules `processDocument()` action
5. Document is processed and status updated to "completed"

### Document Processing
- **PDF Processing**: Extracts text page by page, detects table patterns
- **DOCX Processing**: Extracts text and formatting, detects tables
- **Table Detection**: Identifies tables using alignment heuristics
- **Status Tracking**: Updates from "pending" → "processing" → "completed/failed"

### AI Context Enhancement
- Documents are automatically included in AI context
- First 5000 characters of text included
- All detected tables shown in markdown format
- AI can reference specific document content

## Error Handling

- **File not found**: Returns clear error message
- **Processing failed**: Stores error in `errorMessage` field
- **Table not found**: AI responds with helpful message to check document format
- **Invalid document**: Validation on file type (PDF/DOCX only)

## Limitations

- Document text limited to 5000 characters in AI context (to avoid token limits)
- Table detection uses heuristics (may miss some tables)
- Currently supports first table found when creating from document
- PDF processing requires readable text (not scanned images)

## Future Enhancements

- OCR support for scanned PDFs
- Image extraction from documents
- Multi-table selection from single document
- Document preview in UI
- Batch document processing
- Custom table detection rules

## Files Modified/Created

### New Files:
- `convex/documents.ts` - Document CRUD and processing
- `DOCUMENT_UPLOAD_FEATURE.md` - This documentation

### Modified Files:
- `convex/schema.ts` - Added documents table
- `convex/ai.ts` - Added document context and table creation logic
- `convex/spreadsheets.ts` - Added internalCreateTableFromDocument
- `package.json` - Added mammoth and pdfjs-dist

## Testing

### Test Document Upload:
1. Upload a PDF with a table
2. Check document status: should be "completed"
3. Check extractedTables: should contain table data

### Test AI Q&A:
1. Upload document
2. Ask: "What's in the document?"
3. AI should summarize content

### Test Table Creation:
1. Upload document with table
2. Ask: "Create a table from the document"
3. Table should appear in spreadsheet

## Troubleshooting

**Problem**: Linter errors about "Property 'documents' does not exist"
**Solution**: Run `npx convex dev` to regenerate API types

**Problem**: Document processing fails
**Solution**: Check file format, ensure PDF has readable text (not scanned)

**Problem**: Table not detected
**Solution**: Ensure table uses tabs, pipes, or consistent spacing in document

**Problem**: AI doesn't see document
**Solution**: Check document processingStatus is "completed"

