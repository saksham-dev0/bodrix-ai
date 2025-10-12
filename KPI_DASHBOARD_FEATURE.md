# KPI Dashboard Feature

## Overview
The KPI Dashboard feature allows users to create comprehensive dashboards with visualizations and key performance indicators (KPIs) by simply asking the AI. The system intelligently analyzes all sheets in a spreadsheet, identifies relevant metrics, and automatically creates a dashboard with appropriate widgets.

## Features

### 1. **Intelligent Data Analysis**
- Automatically analyzes all sheets in a spreadsheet
- Identifies numeric columns (currency, percentages, regular numbers)
- Detects categorical columns for grouping
- Recognizes date columns for time-series analysis
- Handles interlinked data across multiple sheets

### 2. **Automatic Dashboard Creation**
- Creates dashboards through natural language commands
- Generates appropriate visualizations based on data types
- Combines data from multiple sheets intelligently
- No hardcoded logic - fully dynamic based on actual data

### 3. **Multiple Widget Types**
- **Metric Widgets**: Display KPI values with sum/average calculations
- **Chart Widgets**: Bar, line, pie, and area charts
- **Time-Series Charts**: Automatically created when date columns are detected
- **Distribution Charts**: Created for categorical data analysis

### 4. **Smart Visualization Selection**
The AI automatically determines the best visualizations:
- Currency columns → Sum metrics + bar charts
- Numeric columns → Average metrics + charts
- Categorical + Numeric → Bar and pie charts
- Date + Numeric → Line charts for trends

## How to Use

### Creating a Dashboard

Simply ask the AI in the chat sidebar:
```
"Create a KPI dashboard"
"Make a dashboard for sales data"
"Build a dashboard showing user metrics"
"Generate a KPI dashboard"
```

The AI will:
1. Analyze all sheets in your spreadsheet
2. Identify relevant numeric and categorical columns
3. Create appropriate KPIs and visualizations
4. Display a success message with dashboard details

### Viewing Dashboards

1. Navigate to the **Dashboards** tab at the bottom of the spreadsheet page
2. Click **View** on any dashboard card
3. The dashboard opens in a modal with all widgets properly laid out

### Managing Dashboards

- **View**: Click the eye icon to open the dashboard
- **Delete**: Click the trash icon to remove a dashboard
- Dashboards are automatically saved and persisted

## Example Use Cases

### Example 1: E-commerce Dashboard
**Data**: 3 sheets (Products, Sales, Users)
- Products sheet: product_name, price, category
- Sales sheet: product_id, quantity, date, revenue
- Users sheet: user_id, name, signup_date

**AI Command**: "Create a sales dashboard"

**Result**: Dashboard with:
- Total Revenue metric
- Average Order Value metric
- Revenue by Category bar chart
- Revenue Over Time line chart
- Product Distribution pie chart

### Example 2: HR Dashboard
**Data**: 1 sheet (Employees)
- Columns: name, department, salary, position, hire_date

**AI Command**: "Make a KPI dashboard"

**Result**: Dashboard with:
- Total Salary metric
- Average Salary metric
- Salary by Department bar chart
- Salary Distribution pie chart
- Hiring Trends line chart

### Example 3: Marketing Dashboard
**Data**: 2 sheets (Campaigns, Metrics)
- Campaigns: campaign_name, budget, platform
- Metrics: campaign_id, impressions, clicks, conversions, date

**AI Command**: "Build a marketing performance dashboard"

**Result**: Dashboard with:
- Total Budget metric
- Average Conversions metric
- Performance by Campaign bar chart
- Platform Distribution pie chart
- Conversions Over Time line chart

## Technical Implementation

### Backend Architecture

#### 1. Schema (`convex/schema.ts`)
- **dashboards table**: Stores dashboard metadata
- **dashboardWidgets table**: Stores individual widgets with positioning

#### 2. Dashboard CRUD (`convex/dashboards.ts`)
- `getDashboards`: List all dashboards for a spreadsheet
- `getDashboard`: Get a single dashboard with all widgets
- `createDashboard`: Create a new dashboard
- `addWidget`: Add a widget to a dashboard
- `deleteDashboard`: Delete a dashboard and all widgets

#### 3. AI Integration (`convex/ai.ts`)
- **Detection**: Recognizes dashboard creation requests
- **Analysis**: `analyzeSheetsForDashboard` function that:
  - Parses all sheets
  - Identifies column types (numeric, categorical, date)
  - Calculates statistics (sum, average, min, max)
  - Determines optimal visualizations
  - Creates dashboard with widgets

#### 4. Smart Analysis Algorithm
```typescript
For each sheet:
  1. Find header row (first 5 rows)
  2. Analyze each column:
     - Count numeric values → Numeric column
     - Check date patterns → Date column
     - Check unique values → Categorical column
  3. Classify numeric columns:
     - Contains "price", "cost", "amount" → Currency
     - Contains "percent", "rate" → Percentage
     - Otherwise → Number
  4. Create appropriate widgets:
     - Numeric columns → Metric widgets
     - Categorical + Numeric → Bar/Pie charts
     - Date + Numeric → Line charts
```

### Frontend Components

#### 1. `KPIDashboard.tsx`
- Renders dashboard with all widgets
- Responsive grid layout (12-column system)
- Widget types: metric, chart, table, text
- Integrates with ChartJS for visualizations

#### 2. `DashboardList.tsx`
- Lists all dashboards for a spreadsheet
- Card-based UI with view and delete actions
- Modal view for full dashboard display
- Empty state with helpful instructions

#### 3. Integration in Spreadsheet Page
- **Tabs**: Charts | Dashboards
- Switch between charts and dashboard views
- Seamless integration with existing UI

## Data Requirements

### Minimum Requirements
- At least 1 sheet with data
- At least 1 numeric column with 3+ values
- Column headers in the first 5 rows

### Optimal Data Structure
- Clear column headers in the first row
- Consistent data types within columns
- At least one categorical column for grouping
- Numeric columns for KPI calculations

### Supported Column Types
- **Numeric**: Integers, decimals, currency
- **Categorical**: Text with repeating values
- **Date**: ISO dates (YYYY-MM-DD) or US format (MM/DD/YYYY)

## AI Prompts

### Dashboard Creation
- "Create a KPI dashboard"
- "Make a dashboard"
- "Build a dashboard showing [topic]"
- "Generate a KPI dashboard for [data]"
- "Show me a dashboard"

### Natural Language Support
The AI understands various phrasings:
- "Create a dashboard for sales"
- "Make a KPI dashboard"
- "Build me a dashboard"
- "Generate key performance indicators"
- "Show dashboard"

## Widget Layout System

### Grid System
- 12-column grid layout
- Widgets can span 1-12 columns
- Row-based positioning

### Default Widget Sizes
- **Metric widgets**: 3 columns × 2 rows
- **Bar/Pie charts**: 6 columns × 4 rows
- **Line charts**: 12 columns × 4 rows

### Auto Layout Algorithm
```
1. Metrics are placed in rows of 4 (3 cols each)
2. Charts start on new rows (full or half width)
3. Widgets are organized by sheet, then by type
```

## Benefits

1. **No Manual Configuration**: Users don't need to specify ranges, columns, or chart types
2. **Intelligent Analysis**: System understands data relationships and creates relevant KPIs
3. **Multi-Sheet Support**: Combines data from all sheets intelligently
4. **Dynamic Adaptation**: Works with any data structure without hardcoding
5. **Professional Dashboards**: Auto-generated dashboards look polished and organized
6. **Time-Saving**: Creates comprehensive dashboards in seconds

## Limitations & Future Enhancements

### Current Limitations
- Table widgets not yet implemented
- No custom widget positioning (auto-layout only)
- Limited to 20 unique categorical values per chart

### Future Enhancements
1. **Custom Dashboard Editing**: Manual widget arrangement
2. **Dashboard Templates**: Pre-built dashboard types
3. **Real-time Updates**: Live data refresh
4. **Export Options**: PDF, PNG export
5. **Advanced Filters**: Date ranges, category filters
6. **Cross-Sheet Joins**: Automatic data joining by common columns
7. **Custom Metrics**: User-defined calculations
8. **Dashboard Sharing**: Share dashboards with team members

## Code Structure

```
convex/
├── schema.ts                 # Database schema (dashboards, dashboardWidgets)
├── dashboards.ts            # CRUD operations for dashboards
└── ai.ts                    # AI logic and data analysis

src/components/
├── KPIDashboard.tsx         # Dashboard renderer
├── DashboardList.tsx        # Dashboard list UI
├── ChartJSFromRange.tsx     # Chart rendering (existing)
└── ResizableAISidebar.tsx   # AI chat interface (existing)

src/app/dashboard/projects/[projectId]/spreadsheet/
└── page.tsx                 # Main spreadsheet page with tabs
```

## API Reference

### Queries
```typescript
// Get all dashboards for a spreadsheet
getDashboards(spreadsheetId: Id<"spreadsheets">)

// Get a single dashboard with widgets
getDashboard(dashboardId: Id<"dashboards">)
```

### Mutations
```typescript
// Create a dashboard
createDashboard({
  spreadsheetId: Id<"spreadsheets">,
  name: string,
  description?: string
})

// Delete a dashboard
deleteDashboard({ dashboardId: Id<"dashboards"> })

// Add a widget
addWidget({
  dashboardId: Id<"dashboards">,
  type: "chart" | "metric" | "table" | "text",
  title: string,
  // ... widget-specific properties
})
```

### Internal Functions (AI-only)
```typescript
// Analyze sheets and create dashboard
analyzeSheetsForDashboard({
  spreadsheetId: Id<"spreadsheets">,
  ownerId: Id<"users">,
  userMessage: string
})
```

## Testing

### Test Scenarios

1. **Single Sheet with Numeric Data**
   - Create a sheet with columns: name, age, salary
   - Ask: "Create a KPI dashboard"
   - Expected: Metrics for average age and total salary

2. **Multiple Sheets with Related Data**
   - Sheet 1: users (id, name, email)
   - Sheet 2: transactions (user_id, amount, date)
   - Ask: "Make a dashboard"
   - Expected: Dashboard with metrics and charts from both sheets

3. **Time Series Data**
   - Create a sheet with date and revenue columns
   - Ask: "Build a dashboard"
   - Expected: Line chart showing revenue over time

4. **Categorical Data**
   - Create a sheet with category and values
   - Ask: "Generate a dashboard"
   - Expected: Bar chart and pie chart for distribution

## Conclusion

The KPI Dashboard feature represents a significant advancement in data visualization capabilities. By leveraging AI to understand data structure and relationships, it enables users to create professional dashboards with zero configuration. The system is designed to be flexible, intelligent, and user-friendly, making data analysis accessible to all users regardless of technical expertise.

