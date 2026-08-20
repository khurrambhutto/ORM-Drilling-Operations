# ORM Drilling Operations Dashboard Setup

## Overview
This application displays drilling operations data with support for multiple fiscal year plans per quarter. The database has been updated to accommodate multiple well names and depths in the fiscal year quarters.

## Database Setup

### 1. Create Database
```sql
USE [master]
CREATE DATABASE [ORM DRILLING OPERATIONS]
```

### 2. Run Database Schema
Execute the `database_schema.sql` file in SQL Server Management Studio or your preferred SQL client.

### 3. Update Database Configuration
In `server.js`, update the database configuration:
```javascript
const config = {
  user: 'your_username',
  password: 'your_password',
  server: 'localhost',
  database: 'ORM DRILLING OPERATIONS',
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
};
```

## Installation

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Backend Server
```bash
node server.js
```
The backend will run on `http://localhost:3001`

### 3. Start Frontend Application
```bash
npm start
```
The frontend will run on `http://localhost:3000`

## Key Features

### Updated Database Schema
- **FiscalYearPlan Table**: Now supports multiple wells per quarter
- **Well Coordinates**: Added Latitude and Longitude for map display
- **LastUpdated Field**: Tracks when operations were last updated

### Frontend Improvements
- **Centered Alignment**: All text, charts, and components are center-aligned
- **Fiscal Year Display**: New component to show multiple wells per quarter
- **Moving Charts**: Carousel of pie charts for all wells
- **Interactive Maps**: Province images and well location maps

### Backend API Endpoints
- `GET /drilling-operations` - Fetch all drilling operations
- `GET /fiscal-year-plans/:drillingOperationID` - Fetch fiscal year plans
- `PUT /drilling-operations/:id` - Update drilling operation

## Database Structure

### Tables
1. **Rig** - Unique rigs
2. **Block** - Geographic blocks
3. **Well** - Wells with coordinates
4. **AFEPlan** - Authorization for Expenditure plans
5. **ActualRigDays** - Actual rig days data
6. **FiscalYearPlan** - Multiple wells per quarter
7. **DrillingOperation** - Main operations table

### Fiscal Year Plans
The `FiscalYearPlan` table now supports:
- Multiple wells per quarter
- Well depths and details
- Plan details and dates
- Proper quarter ordering

## Data from Images
The database has been populated with accurate data from the provided images:
- 13 drilling rigs
- Multiple wells per fiscal year quarter
- Accurate operation logs and stop cards
- Proper coordinates for map display

## Troubleshooting

### Common Issues
1. **Database Connection**: Ensure SQL Server is running and credentials are correct
2. **Port Conflicts**: Make sure ports 3000 and 3001 are available
3. **CORS Issues**: Backend includes CORS middleware for frontend communication

### Dependencies
- React 19.1.0
- Express 4.18.2
- MSSQL 10.0.2
- Recharts 3.1.0
- Leaflet 1.9.4

## File Structure
```
├── src/
│   ├── DrillingDashboard.js    # Main dashboard component
│   ├── WellPieChartBox.js     # Moving chart boxes
│   ├── FiscalYearDisplay.js   # Fiscal year plans display
│   └── App.js                 # Root component
├── server.js                   # Backend API server
├── database_schema.sql         # Database schema and data
└── package.json               # Dependencies
``` 