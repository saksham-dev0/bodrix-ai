# SheetJS x-spreadsheet Integration

This project now includes a complete integration of SheetJS Community Edition with x-spreadsheet, providing a professional Excel-like interface for spreadsheet editing.

## Features

### ✅ Excel-like Interface
- **Professional UI**: Full Excel-like interface with toolbar, grid, and context menus
- **Rich Formatting**: Bold, italic, colors, alignment, and more
- **Formula Support**: Excel-compatible formulas with real-time calculation
- **Multiple Sheets**: Support for multiple worksheets
- **Cell Selection**: Click, drag, and keyboard navigation

### ✅ SheetJS Integration
- **Import/Export**: Full Excel file (.xlsx, .xls) import and export
- **Data Conversion**: Seamless conversion between SheetJS and x-spreadsheet formats
- **Formula Preservation**: Formulas are maintained during import/export
- **Style Preservation**: Cell formatting is preserved during conversion

### ✅ Backend Integration
- **Convex Database**: Full integration with Convex backend
- **Real-time Sync**: Changes are saved to the database
- **Data Persistence**: Spreadsheet data is stored in x-spreadsheet format
- **User Authentication**: Secure access with Clerk authentication

## Architecture

### Frontend Components

1. **`SheetJSXSpreadsheet`** (`src/components/sheetjs-xspreadsheet.tsx`)
   - Main component integrating SheetJS with x-spreadsheet
   - Handles data loading, saving, and conversion
   - Provides Excel import/export functionality

2. **`TestSheetJSIntegration`** (`src/components/test-sheetjs-integration.tsx`)
   - Test component to verify integration
   - Demonstrates data conversion between formats

### Backend Functions

1. **Schema Updates** (`convex/schema.ts`)
   - Added `xSpreadsheetData` field to spreadsheets table
   - Stores x-spreadsheet data as JSON string

2. **New Mutations** (`convex/spreadsheets.ts`)
   - `updateSpreadsheetData`: Updates x-spreadsheet data
   - Enhanced `getSpreadsheetData`: Returns x-spreadsheet data

### Data Flow

```
Excel File (.xlsx) 
    ↓ (SheetJS.read)
SheetJS Workbook
    ↓ (stox conversion)
x-spreadsheet Data
    ↓ (JSON.stringify)
Convex Database
    ↓ (JSON.parse)
x-spreadsheet Data
    ↓ (x-spreadsheet.loadData)
Excel-like Interface
```

## Usage

### Basic Usage

```tsx
import { SheetJSXSpreadsheet, SheetJSXSpreadsheetRef } from "@/components/sheetjs-xspreadsheet";

function MyComponent() {
  const spreadsheetRef = useRef<SheetJSXSpreadsheetRef>(null);

  const handleSave = async () => {
    await spreadsheetRef.current?.saveChanges();
  };

  const handleExport = () => {
    spreadsheetRef.current?.exportToExcel();
  };

  return (
    <SheetJSXSpreadsheet
      ref={spreadsheetRef}
      spreadsheetId={spreadsheetId}
      onDataChange={(data) => console.log('Data changed:', data)}
    />
  );
}
```

### Excel Import/Export

```tsx
// Export to Excel
const exportToExcel = () => {
  spreadsheetRef.current?.exportToExcel();
};

// Import from Excel
const importFromExcel = async (file: File) => {
  await spreadsheetRef.current?.importFromExcel(file);
};
```

## Data Conversion

### SheetJS to x-spreadsheet (stox)

```typescript
const stox = (wb: XLSX.WorkBook) => {
  // Converts SheetJS workbook to x-spreadsheet format
  // Handles cells, formulas, and basic styling
};
```

### x-spreadsheet to SheetJS (xtos)

```typescript
const xtos = (data: any[]) => {
  // Converts x-spreadsheet data to SheetJS workbook
  // Preserves formulas and styling
};
```

## Testing

### Test Page
Visit `/test-sheetjs` to see the integration in action with sample data.

### Test Component
The `TestSheetJSIntegration` component demonstrates:
- SheetJS workbook creation
- Data conversion between formats
- x-spreadsheet loading and display
- Error handling

## Dependencies

### Required Packages
```json
{
  "xlsx": "^0.18.5",
  "x-data-spreadsheet": "^1.1.9"
}
```

### CDN Resources
- x-spreadsheet CSS: `https://unpkg.com/x-data-spreadsheet/dist/xspreadsheet.css`
- x-spreadsheet JS: `https://unpkg.com/x-data-spreadsheet/dist/xspreadsheet.js`

## Migration from Previous Implementation

### What Changed
1. **Replaced custom spreadsheet components** with x-spreadsheet
2. **Added SheetJS integration** for Excel import/export
3. **Updated database schema** to support x-spreadsheet format
4. **Enhanced backend functions** for new data format

### Backward Compatibility
- Existing cell-based data is automatically converted to x-spreadsheet format
- Old spreadsheets will work seamlessly with the new interface
- No data loss during migration

## Performance

### Optimizations
- **Lazy Loading**: x-spreadsheet is loaded only when needed
- **Efficient Conversion**: Data conversion happens only during import/export
- **Minimal Re-renders**: Changes are batched and optimized
- **Memory Management**: Proper cleanup of x-spreadsheet instances

### Limitations
- Large spreadsheets (>10,000 cells) may experience performance issues
- Complex formulas may not be fully supported
- Some advanced Excel features are not available

## Browser Support

### Supported Browsers
- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

### Required Features
- ES6+ support
- Canvas API
- CSS Grid/Flexbox
- Modern JavaScript features

## Troubleshooting

### Common Issues

1. **x-spreadsheet not loading**
   - Check network connection
   - Verify CDN resources are accessible
   - Check browser console for errors

2. **Data not saving**
   - Verify Convex connection
   - Check authentication status
   - Review backend function logs

3. **Import/Export issues**
   - Ensure file format is supported (.xlsx, .xls)
   - Check file size limits
   - Verify SheetJS is properly loaded

### Debug Mode
Enable debug logging by setting:
```typescript
console.log('SheetJS Integration Debug:', true);
```

## Future Enhancements

### Planned Features
- [ ] Advanced formula support
- [ ] Chart integration
- [ ] Collaborative editing
- [ ] Version history
- [ ] Advanced formatting options
- [ ] Print functionality
- [ ] Mobile optimization

### Performance Improvements
- [ ] Virtual scrolling for large datasets
- [ ] Web Workers for formula calculation
- [ ] Caching for frequently accessed data
- [ ] Optimized data structures

## Contributing

### Development Setup
1. Install dependencies: `npm install`
2. Start development server: `npm run dev`
3. Visit test page: `http://localhost:3000/test-sheetjs`

### Code Style
- Use TypeScript for type safety
- Follow existing component patterns
- Add proper error handling
- Include JSDoc comments for functions

### Testing
- Test with various Excel file formats
- Verify data conversion accuracy
- Check performance with large datasets
- Test cross-browser compatibility

## License

This integration follows the same license as the main project. SheetJS Community Edition and x-spreadsheet have their own respective licenses.
