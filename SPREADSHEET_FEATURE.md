# Excel-like Spreadsheet Feature

This project now includes a Microsoft Excel-like spreadsheet engine with the following features:

## Features Implemented

### 1. Project Management
- **Projects Page**: Users can create, view, and manage spreadsheet projects
- **Add Project Button**: Click to create new projects with name and description
- **Project Cards**: Visual representation of projects with creation date and owner info

### 2. Spreadsheet Engine
- **Excel-like UI**: Grid-based interface with rows and columns
- **Cell Editing**: Click to select, double-click to edit cells
- **Formula Support**: Enter formulas starting with "=" (basic evaluation)
- **Keyboard Navigation**: Arrow keys to navigate between cells
- **Real-time Updates**: Changes are saved to the database automatically

### 3. Database Schema
- **Projects Table**: Stores project information
- **Spreadsheets Table**: Links spreadsheets to projects
- **Cells Table**: Stores individual cell data, formulas, and styling

### 4. Core Functionality
- **Cell Values**: Store text and numeric values
- **Formulas**: Basic formula evaluation (SUM, basic math operations)
- **Styling**: Cell formatting options (background, text color, font weight, etc.)
- **Navigation**: Excel-like keyboard shortcuts and mouse interactions

## How to Use

1. **Navigate to Projects**: Go to `/dashboard/projects`
2. **Create Project**: Click "Add Project" button
3. **Enter Details**: Provide project name and optional description
4. **Access Spreadsheet**: Click on any project to open the spreadsheet
5. **Edit Cells**: 
   - Click to select a cell
   - Double-click to edit
   - Type values or formulas (starting with "=")
   - Use arrow keys to navigate

## Technical Implementation

### Frontend Components
- `ProjectsPage`: Main projects listing and creation
- `SpreadsheetPage`: Spreadsheet container with header controls
- `SpreadsheetEngine`: Core spreadsheet grid and cell management

### Backend Functions
- `projects.ts`: Project CRUD operations
- `spreadsheets.ts`: Spreadsheet and cell management
- Database schema with proper indexing for performance

### Key Features
- **Real-time Sync**: Uses Convex for real-time data synchronization
- **Responsive Design**: Works on desktop and mobile devices
- **Excel-like UX**: Familiar interface for spreadsheet users
- **Formula Engine**: Basic formula evaluation and cell referencing

## Future Enhancements

- Advanced formula functions (VLOOKUP, IF, etc.)
- Chart creation and visualization
- Cell formatting toolbar
- Undo/Redo functionality
- Copy/Paste operations
- Multiple sheets per spreadsheet
- Collaborative editing
- Export to Excel/CSV formats
