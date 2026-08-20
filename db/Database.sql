USE [ORM DRILLING OPERATIONS]

-- Table for storing unique rigs
CREATE TABLE Rig (
    RigID INT PRIMARY KEY IDENTITY,
    RigNo VARCHAR(20) UNIQUE NOT NULL
);

-- Table for storing unique blocks
CREATE TABLE Block (
    BlockID INT PRIMARY KEY IDENTITY,
    BlockName VARCHAR(50) UNIQUE NOT NULL
);

-- Table for storing wells, each well belongs to a block

CREATE TABLE Well (
    WellID INT IDENTITY UNIQUE,
    WellName VARCHAR(50) NOT NULL PRIMARY KEY,
    BlockID INT NOT NULL,
    Latitude FLOAT NULL,
    Longitude FLOAT NULL,
    -- New status-based lifecycle columns
    IsActive BIT NOT NULL CONSTRAINT DF_Well_IsActive DEFAULT(1),
    DeactivatedAt DATETIME NULL,
    FOREIGN KEY (BlockID) REFERENCES Block(BlockID)
);

-- Table for daily well progress (one row per day per well, pre-created at well creation)
CREATE TABLE WellDailyProgress (
    WellDailyProgressID INT PRIMARY KEY IDENTITY,
    WellID INT NOT NULL,
    WellName VARCHAR(50) NOT NULL,
    [Date] DATE NOT NULL,
    [Day] INT NOT NULL, -- 0 = spud date, increments
    PlannedDepth BIGINT,
    ActualDepth BIGINT,
    Progress BIGINT,
    OperationLog TEXT,
    CONSTRAINT FK_WellDailyProgress_WellID FOREIGN KEY (WellID) REFERENCES Well(WellID),
    CONSTRAINT UQ_WellDailyProgress UNIQUE (WellName, [Date])
);

-- Table for storing AFE (Authorization for Expenditure) plans
CREATE TABLE AFEPlan (
    AFEPlanID INT PRIMARY KEY IDENTITY,
    DrlgDays INT,
    TestDays INT
);

-- Table for storing actual rig days
CREATE TABLE ActualRigDays (
    ActualRigDaysID INT PRIMARY KEY IDENTITY,
    DryDays INT,
    TestWODays INT
);

-- Table for storing fiscal year plans with multiple wells per quarter
CREATE TABLE FiscalYearPlan (
    FiscalYearPlanID INT PRIMARY KEY IDENTITY,
    FY VARCHAR(10),
    QTR VARCHAR(10),
    WellName VARCHAR(100),
    WellDepth VARCHAR(50),
    PlanDetails VARCHAR(100)
);

-- Central table for drilling operations, referencing all other tables
CREATE TABLE DrillingOperation (
    DrillingOperationID INT PRIMARY KEY IDENTITY,
    SrNo INT,
    RigID INT NOT NULL,
    WellID INT NOT NULL,
    SpudDate DATE,
    PresentDepthM INT,
    TDM INT,
    AFEPlanID INT,
    MDrld VARCHAR(20),
    WeeklyM VARCHAR(20),
    ActualRigDaysID INT,
    OperationLog NVARCHAR(MAX),
    StopCard INT,
    LastUpdated DATETIME NULL,
    FOREIGN KEY (RigID) REFERENCES Rig(RigID),
    FOREIGN KEY (WellID) REFERENCES Well(WellID),
    FOREIGN KEY (AFEPlanID) REFERENCES AFEPlan(AFEPlanID),
    FOREIGN KEY (ActualRigDaysID) REFERENCES ActualRigDays(ActualRigDaysID)
);

-- Clear existing data
DELETE FROM DrillingOperation;
DELETE FROM FiscalYearPlan;
DELETE FROM ActualRigDays;
DELETE FROM AFEPlan;
DELETE FROM Well;
DELETE FROM Block;
DELETE FROM Rig;

-- Insert Rigs
INSERT INTO Rig (RigNo) VALUES
('SLR-225'),
('T-72'),
('CCDC-32'),
('N-5'),
('N-6'),
('N-2'),
('T-202'),
('CCDC-31'),
('HL-5'),
('N-55'),
('SK-750'),
('N-3'),
('N-4');

-- Insert Blocks
INSERT INTO Block (BlockName) VALUES
('Wali EL'),
('Nashpa EL (KPK)'),
('Bitrism EL'),
('TAY EL'),
('Paaskai & Pasakhi N D&PL (Sindh)'),
('Sindh'),
('Gurglot EL (KPK)'),
('D&PL (Sindh)'),
('QP D&PL (Sindh)'),
('Punjab');

-- Insert Wells with coordinates
INSERT INTO Well (WellName, BlockID, Latitude, Longitude) VALUES
('Bettani Deep-1', 1, 32.9000, 70.9000),
('Baragzai-X1', 2, 33.2000, 71.3500),
('Bitrism East-1', 3, 27.7000, 68.9000),
('Chakar-1', 4, 25.4000, 69.0000),
('Pasakhi-14', 5, 27.5000, 68.8000),
('Khatian-1', 6, 27.3000, 68.7000),
('Gurgalot X-1', 7, 33.1000, 71.2000),
('Jakhro North-1', 8, 27.6000, 68.6000),
('QP-64', 9, 27.4000, 68.5000),
('Dars Deep-1A (RE)', 6, 27.2000, 68.4000),
('KNR-3 (W/O)', 6, 27.1000, 68.3000),
('Toot Deep-1', 10, 32.5000, 73.1000),
('Rajian-9', 10, 32.6000, 73.2000);

-- Insert AFE Plans
INSERT INTO AFEPlan (DrlgDays, TestDays) VALUES
(320, 100),
(268, 85),
(79, 35),
(30, 25),
(45, 40),
(44, 35),
(280, 70),
(63, 25),
(51, 4),
(NULL, NULL),
(NULL, NULL),
(45, NULL),
(30, NULL);

-- Insert Actual Rig Days
INSERT INTO ActualRigDays (DryDays, TestWODays) VALUES
(550, 22),
(200, NULL),
(18, NULL),
(40, 7),
(18, NULL),
(26, 21),
(20, NULL),
(56, 11),
(19, NULL),
(NULL, NULL),
(NULL, NULL),
(125, NULL),
(15, NULL);

-- Insert Fiscal Year Plans with multiple wells per quarter
INSERT INTO FiscalYearPlan (FY, QTR, WellName, WellDepth, PlanDetails) VALUES
-- For Rig N-5 (Chakar-1)
('2025-26', '1st QTR', 'Dars Deep-1 (R/E)', '3350 M', '30-06-2025'),
('2025-26', '2nd QTR', 'Thal West-1A', NULL, NULL),
('2025-26', '3rd QTR', 'KNR WIW Chak 63-5', '3500 M', NULL),
('2025-26', '4th QTR', 'Sinjhoro X-1', '3880 M', NULL),

-- For Rig N-6 (Pasakhi-14)
('2025-26', '1st QTR', 'Jand-1 (W/O)', NULL, NULL),
('2025-26', '2nd QTR', 'Jandran W-2', '1900 M', NULL),
('2025-26', '3rd QTR', 'Lakhi Rud X-1', '2500 M', NULL),
('2025-26', '4th QTR', 'Kalerishum-A1', '2500 M', NULL),

-- For Rig N-2 (Khatian-1)
('2025-26', '1st QTR', 'Chandio-1 (W/O)', NULL, NULL),
('2025-26', '2nd QTR', 'Gaja wah-1 (W/O)', NULL, NULL),
('2025-26', '3rd QTR', 'Katiar-1 (W/O)', NULL, 'URS/Thal East'),
('2025-26', '4th QTR', 'Baloch-1', NULL, 'Sembar'),

-- For Rig CCDC-32 (Bitrism East-1)
('2025-26', '2nd QTR', 'KNR Deep-12', '4000 M', NULL),
('2025-26', '4th QTR', 'Sinjhoro W-1', '3880 M', NULL),

-- For Rig CCDC-31 (Jakhro North-1)
('2025-26', '1st QTR', 'Bobi-11', NULL, NULL),
('2025-26', '2nd QTR', 'Dars W-3', '2000 M', NULL),
('2025-26', '3rd QTR', 'Pasakhi-13', '3045 M', NULL),
('2025-26', '4th QTR', 'Sinjhoro X-1', '3880 M', NULL),

-- For Rig HL-5 (QP-64)
('2025-26', '1st QTR', 'Bobi-12', NULL, NULL),
('2025-26', '2nd QTR', 'Dars W-4', '2000 M', NULL),
('2025-26', '3rd QTR', 'Pasakhi-14', '3045 M', NULL),
('2025-26', '4th QTR', 'Sinjhoro X-2', '3880 M', NULL);

-- Insert Drilling Operations
INSERT INTO DrillingOperation (
    SrNo, RigID, WellID, SpudDate, PresentDepthM, TDM, AFEPlanID,
    MDrld, WeeklyM, ActualRigDaysID, OperationLog, StopCard, LastUpdated
) VALUES
(1, 1, 1, '2023-12-24', 5663, 5920, 1, '320', '100', 1, 'Well under Production. Reamed/Cleaned hole f/4484 to 4515m. Circ is in progress. STOP cards = 16', 16, GETDATE()),
(2, 2, 2, '2024-12-30', 4172, 5815, 2, '268', '85', 2, 'Well under Drilling. P/T BOP stack- ok. RIH w/RR 8-1/2" PDC bit + RSS assy to 4150m. Drilled 8-1/2" hole f/4164 to 4172m & is in progress. STOP cards: 22 OGDC The Energy 65%, PPL 30%, GHPL 5%', 22, GETDATE()),
(3, 3, 3, NULL, 1326, 3880, 3, '79', '35', 3, 'Well under Drilling. RIH f/698m to 1310m. Drilled17-1/2" hole f/1310 to 1322.50m. obsd complete loss. Continue with blind drilling down to 1326m & is in progress. STOP card=13 OGDC The Energy 95%, GHPL 5%', 13, GETDATE()),
(4, 4, 4, '2025-06-01', 1926, 1925, 4, '30', '25', 4, 'Well under Production. RIH CT, c/out perforation wash with acid. Terminated DST, reverse circ & unset pkr. POH to 1200m & is in progress.. STOP cards: 02', 2, GETDATE()),
(5, 5, 5, '2025-06-30', 1273, 2100, 5, '45', '40', 5, 'Well under Drilling. Conducted FPIT survey; 75% free at 1133m. Worked on stuck string with max safe overpull is in progress. STOP cards: 04', 4, GETDATE()),
(6, 6, 6, '2025-06-27', 1421, 2650, 6, '44', '35', 6, 'Well under Drilling: Drilled 12-1/4" hole f/1395 to 1421m. Circ, POH to 1312m. Obsd tight hole. RIH & increased MW 1.36 to 1.38S.G. POH to 1242m & is in progress. STOP cards: - 08', 8, GETDATE()),
(7, 7, 7, '2025-06-28', 400, 5400, 7, '280', '70', 7, 'Well under Drilling: POOH. RIH 24-1/2" CSG to 29m, obsd obstruction & POOH, RIH w/RR 28" TC bit to 21m. Reamed/cleaned hole to 69m. Work on TDS is in progress. STOP cards: - 15. OGDC The Energy 75%, POL 20%, GHPL 5%', 15, GETDATE()),
(8, 8, 8, '2025-06-30', 606, 3600, 8, '63', '25', 8, 'Well under Drilling: RIH f/338 to 547m. Drilled F/S +formation to 553m. Displaced hole mud with KCL polymer mud 1.15SG. Conducted FIT. Drilled hole down to 606m & is in progress. STOP cards: 16. OGDC The Energy 77%, GHPL 22.5%', 16, GETDATE()),
(9, 9, 9, '2025-06-29', 1395, 2364, 9, '51', '04', 9, 'Well under Drilling: RIH string shot & backed off string from 932m; 48m fish left in hole. RIH w/fishing assy (screw-in sub) to 600m & is in progress. STOP cards: 10. OGDC The Energy 77%, GHPL 22.5%', 10, GETDATE()),
(10, 10, 10, '2025-06-30', NULL, NULL, 10, NULL, NULL, 10, 'Rig Down 90% & is in progress.', 4, GETDATE()),
(11, 11, 11, NULL, 300, 3045, 11, NULL, NULL, 11, 'Rig Building 70% & is in progress.', 2, GETDATE()),
(12, 12, 12, NULL, NULL, NULL, 12, '45', NULL, 12, 'Rig under Production (W/O): P/T BOP stack. RIH 7" -15K DST PKR assy w/3-1/2" tubing 1290m & is in progress. STOP cards: 09', 9, GETDATE()),
(13, 13, 13, NULL, NULL, NULL, 13, '30', NULL, 13, 'Rig under Production (W/O): Press tested BOP stack –ok. RIH with plug retrieving tool to 1177m & is in progress. STOP cards: 05', 5, GETDATE());

-- Query to view all data
SELECT * FROM Rig;
SELECT * FROM Block;
SELECT * FROM Well;
SELECT * FROM AFEPlan;
SELECT * FROM ActualRigDays;
SELECT * FROM FiscalYearPlan;
SELECT * FROM DrillingOperation;



------------

USE [ORM DRILLING OPERATIONS]

-- Create FiscalYearPlan table if it doesn't exist
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[FiscalYearPlan]') AND type in (N'U'))
BEGIN
    CREATE TABLE FiscalYearPlan (
        FiscalYearPlanID INT PRIMARY KEY IDENTITY,
        FY VARCHAR(10),
        QTR VARCHAR(10),
        WellName VARCHAR(100),
        WellDepth VARCHAR(50),
        PlanDetails VARCHAR(100)
    );
END

-- Add FiscalYearPlanID column to DrillingOperation if it doesn't exist
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[DrillingOperation]') AND name = 'FiscalYearPlanID')
BEGIN
    ALTER TABLE DrillingOperation ADD FiscalYearPlanID INT NULL;
END

-- Add foreign key constraint if it doesn't exist
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_DrillingOperation_FiscalYearPlan')
BEGIN
    ALTER TABLE DrillingOperation 
    ADD CONSTRAINT FK_DrillingOperation_FiscalYearPlan 
    FOREIGN KEY (FiscalYearPlanID) REFERENCES FiscalYearPlan(FiscalYearPlanID);
END

-- Clear existing fiscal year data
DELETE FROM FiscalYearPlan;

-- Insert Fiscal Year Plans with multiple wells per quarter
INSERT INTO FiscalYearPlan (FY, QTR, WellName, WellDepth, PlanDetails) VALUES
-- For Rig N-5 (Chakar-1)
('2025-26', '1st QTR', 'Dars Deep-1 (R/E)', '3350 M', '30-06-2025'),
('2025-26', '2nd QTR', 'Thal West-1A', NULL, NULL),
('2025-26', '3rd QTR', 'KNR WIW Chak 63-5', '3500 M', NULL),
('2025-26', '4th QTR', 'Sinjhoro X-1', '3880 M', NULL),

-- For Rig N-6 (Pasakhi-14)
('2025-26', '1st QTR', 'Jand-1 (W/O)', NULL, NULL),
('2025-26', '2nd QTR', 'Jandran W-2', '1900 M', NULL),
('2025-26', '3rd QTR', 'Lakhi Rud X-1', '2500 M', NULL),
('2025-26', '4th QTR', 'Kalerishum-A1', '2500 M', NULL),

-- For Rig N-2 (Khatian-1)
('2025-26', '1st QTR', 'Chandio-1 (W/O)', NULL, NULL),
('2025-26', '2nd QTR', 'Gaja wah-1 (W/O)', NULL, NULL),
('2025-26', '3rd QTR', 'Katiar-1 (W/O)', NULL, 'URS/Thal East'),
('2025-26', '4th QTR', 'Baloch-1', NULL, 'Sembar'),

-- For Rig CCDC-32 (Bitrism East-1)
('2025-26', '2nd QTR', 'KNR Deep-12', '4000 M', NULL),
('2025-26', '4th QTR', 'Sinjhoro W-1', '3880 M', NULL),

-- For Rig CCDC-31 (Jakhro North-1)
('2025-26', '1st QTR', 'Bobi-11', NULL, NULL),
('2025-26', '2nd QTR', 'Dars W-3', '2000 M', NULL),
('2025-26', '3rd QTR', 'Pasakhi-13', '3045 M', NULL),
('2025-26', '4th QTR', 'Sinjhoro X-1', '3880 M', NULL),

-- For Rig HL-5 (QP-64)
('2025-26', '1st QTR', 'Bobi-12', NULL, NULL),
('2025-26', '2nd QTR', 'Dars W-4', '2000 M', NULL),
('2025-26', '3rd QTR', 'Pasakhi-14', '3045 M', NULL),
('2025-26', '4th QTR', 'Sinjhoro X-2', '3880 M', NULL);

-- Update DrillingOperation to link with FiscalYearPlan (optional - you can do this manually)
-- This is just an example - you may want to link specific operations to specific fiscal year plans
-- UPDATE DrillingOperation SET FiscalYearPlanID = 1 WHERE DrillingOperationID = 1;
-- UPDATE DrillingOperation SET FiscalYearPlanID = 2 WHERE DrillingOperationID = 2;
-- etc.

-- Verify the data
SELECT * FROM FiscalYearPlan ORDER BY QTR, WellName;
SELECT * FROM DrillingOperation;




--------------------
USE [ORM DRILLING OPERATIONS]

-- Check if FiscalYearPlan table exists, if not create it
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[FiscalYearPlan]') AND type in (N'U'))
BEGIN
    PRINT 'Creating FiscalYearPlan table...'
    CREATE TABLE FiscalYearPlan (
        FiscalYearPlanID INT PRIMARY KEY IDENTITY,
        FY VARCHAR(10),
        QTR VARCHAR(10),
        WellName VARCHAR(100),
        WellDepth VARCHAR(50),
        PlanDetails VARCHAR(100)
    );
    PRINT 'FiscalYearPlan table created successfully.'
END
ELSE
BEGIN
    PRINT 'FiscalYearPlan table already exists.'
END

-- Check if FiscalYearPlanID column exists in DrillingOperation table
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[DrillingOperation]') AND name = 'FiscalYearPlanID')
BEGIN
    PRINT 'Adding FiscalYearPlanID column to DrillingOperation table...'
    ALTER TABLE DrillingOperation ADD FiscalYearPlanID INT NULL;
    PRINT 'FiscalYearPlanID column added successfully.'
END
ELSE
BEGIN
    PRINT 'FiscalYearPlanID column already exists in DrillingOperation table.'
END

-- Check if foreign key constraint exists
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_DrillingOperation_FiscalYearPlan')
BEGIN
    PRINT 'Adding foreign key constraint...'
    ALTER TABLE DrillingOperation 
    ADD CONSTRAINT FK_DrillingOperation_FiscalYearPlan 
    FOREIGN KEY (FiscalYearPlanID) REFERENCES FiscalYearPlan(FiscalYearPlanID);
    PRINT 'Foreign key constraint added successfully.'
END
ELSE
BEGIN
    PRINT 'Foreign key constraint already exists.'
END

-- Clear existing fiscal year data
DELETE FROM FiscalYearPlan;
PRINT 'Cleared existing fiscal year data.'

-- Insert Fiscal Year Plans with multiple wells per quarter
PRINT 'Inserting fiscal year plans...'
INSERT INTO FiscalYearPlan (FY, QTR, WellName, WellDepth, PlanDetails) VALUES
-- For Rig N-5 (Chakar-1)
('2025-26', '1st QTR', 'Dars Deep-1 (R/E)', '3350 M', '30-06-2025'),
('2025-26', '2nd QTR', 'Thal West-1A', NULL, NULL),
('2025-26', '3rd QTR', 'KNR WIW Chak 63-5', '3500 M', NULL),
('2025-26', '4th QTR', 'Sinjhoro X-1', '3880 M', NULL),

-- For Rig N-6 (Pasakhi-14)
('2025-26', '1st QTR', 'Jand-1 (W/O)', NULL, NULL),
('2025-26', '2nd QTR', 'Jandran W-2', '1900 M', NULL),
('2025-26', '3rd QTR', 'Lakhi Rud X-1', '2500 M', NULL),
('2025-26', '4th QTR', 'Kalerishum-A1', '2500 M', NULL),

-- For Rig N-2 (Khatian-1)
('2025-26', '1st QTR', 'Chandio-1 (W/O)', NULL, NULL),
('2025-26', '2nd QTR', 'Gaja wah-1 (W/O)', NULL, NULL),
('2025-26', '3rd QTR', 'Katiar-1 (W/O)', NULL, 'URS/Thal East'),
('2025-26', '4th QTR', 'Baloch-1', NULL, 'Sembar'),

-- For Rig CCDC-32 (Bitrism East-1)
('2025-26', '2nd QTR', 'KNR Deep-12', '4000 M', NULL),
('2025-26', '4th QTR', 'Sinjhoro W-1', '3880 M', NULL),

-- For Rig CCDC-31 (Jakhro North-1)
('2025-26', '1st QTR', 'Bobi-11', NULL, NULL),
('2025-26', '2nd QTR', 'Dars W-3', '2000 M', NULL),
('2025-26', '3rd QTR', 'Pasakhi-13', '3045 M', NULL),
('2025-26', '4th QTR', 'Sinjhoro X-1', '3880 M', NULL),

-- For Rig HL-5 (QP-64)
('2025-26', '1st QTR', 'Bobi-12', NULL, NULL),
('2025-26', '2nd QTR', 'Dars W-4', '2000 M', NULL),
('2025-26', '3rd QTR', 'Pasakhi-14', '3045 M', NULL),
('2025-26', '4th QTR', 'Sinjhoro X-2', '3880 M', NULL);

PRINT 'Fiscal year plans inserted successfully.'

-- Verify the data
PRINT 'Verifying data...'
SELECT COUNT(*) as TotalFiscalYearPlans FROM FiscalYearPlan;
SELECT QTR, COUNT(*) as WellsInQuarter FROM FiscalYearPlan GROUP BY QTR ORDER BY QTR;

PRINT 'Database update completed successfully!'
PRINT 'You can now restart your Python backend and the frontend should work properly.'


-----------------------------
USE [ORM DRILLING OPERATIONS]

-- Check if FiscalYearPlan table exists, if not create it
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[FiscalYearPlan]') AND type in (N'U'))
BEGIN
    PRINT 'Creating FiscalYearPlan table...'
    CREATE TABLE FiscalYearPlan (
        FiscalYearPlanID INT PRIMARY KEY IDENTITY,
        FY VARCHAR(10),
        QTR VARCHAR(10),
        WellName VARCHAR(100),
        WellDepth VARCHAR(50),
        PlanDetails VARCHAR(100)
    );
    PRINT 'FiscalYearPlan table created successfully.'
END
ELSE
BEGIN
    PRINT 'FiscalYearPlan table already exists.'
END

-- Check if FiscalYearPlanID column exists in DrillingOperation table
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[DrillingOperation]') AND name = 'FiscalYearPlanID')
BEGIN
    PRINT 'Adding FiscalYearPlanID column to DrillingOperation table...'
    ALTER TABLE DrillingOperation ADD FiscalYearPlanID INT NULL;
    PRINT 'FiscalYearPlanID column added successfully.'
END
ELSE
BEGIN
    PRINT 'FiscalYearPlanID column already exists in DrillingOperation table.'
END

-- Add foreign key constraint if it doesn't exist
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_DrillingOperation_FiscalYearPlan')
BEGIN
    PRINT 'Adding foreign key constraint...'
    ALTER TABLE DrillingOperation 
    ADD CONSTRAINT FK_DrillingOperation_FiscalYearPlan 
    FOREIGN KEY (FiscalYearPlanID) REFERENCES FiscalYearPlan(FiscalYearPlanID);
    PRINT 'Foreign key constraint added successfully.'
END
ELSE
BEGIN
    PRINT 'Foreign key constraint already exists.'
END

-- Clear existing fiscal year data
DELETE FROM FiscalYearPlan;
PRINT 'Cleared existing fiscal year data.'

-- Insert comprehensive Fiscal Year Plans for all wells based on the provided images
PRINT 'Inserting comprehensive fiscal year plans for all wells...'

-- Row 1: SLR-225 / Bettani Deep-1 (No fiscal year plans shown in image)
-- Row 2: T-72 / Baragzai-X1 (No fiscal year plans shown in image)

-- Row 3: CCDC-32 / Bitrism East-1
INSERT INTO FiscalYearPlan (FY, QTR, WellName, WellDepth, PlanDetails) VALUES
('2025-26', '2nd QTR', 'KNR Deep-12', '4000 M', 'KNR Deep-12 (4000 M)'),
('2025-26', '4th QTR', 'Sinjhoro W-1', '3880 M', 'Sinjhoro W-1 (3880 M)');

-- Row 4: N-5 / Chakar-1
INSERT INTO FiscalYearPlan (FY, QTR, WellName, WellDepth, PlanDetails) VALUES
('2025-26', '1st QTR', 'Dars Deep-1 (R/E)', '3350 M', 'Dars Deep-1 (R/E) (3350 M) 30-06-2025'),
('2025-26', '2nd QTR', 'Thal West-1A', NULL, 'Thal West-1A'),
('2025-26', '3rd QTR', 'KNR WIW', NULL, 'KNR WIW'),
('2025-26', '3rd QTR', 'Chak 63-5', '3500 M', 'Chak 63-5 (3500 M)'),
('2025-26', '4th QTR', 'Sinjhoro X-1', '3880 M', 'Sinjhoro X-1 (3880 M)');

-- Row 5: N-6 / Pasakhi-14
INSERT INTO FiscalYearPlan (FY, QTR, WellName, WellDepth, PlanDetails) VALUES
('2025-26', '1st QTR', 'Jand-1', NULL, 'Jand-1 (W/O)'),
('2025-26', '2nd QTR', 'Jandran W-2', '1900 M', 'Jandran W-2 (1900 M)'),
('2025-26', '3rd QTR', 'Lakhi Rud X-1', '2500 M', 'Lakhi Rud X-1 (2500 M)'),
('2025-26', '4th QTR', 'Kalerishum-A1', '2500 M', 'Kalerishum-A1 (2500 M)');

-- Row 6: N-2 / Khatian-1
INSERT INTO FiscalYearPlan (FY, QTR, WellName, WellDepth, PlanDetails) VALUES
('2025-26', '1st QTR', 'Chandio-1', NULL, 'Chandio-1 (W/O)'),
('2025-26', '2nd QTR', 'Gaja wah-1', NULL, 'Gaja wah-1 (W/O)'),
('2025-26', '3rd QTR', 'Katiar-1', NULL, 'Katiar-1 (W/O)'),
('2025-26', '4th QTR', 'Baloch-1', NULL, 'Baloch-1 (Sembar)'),
('2025-26', '4th QTR', 'URS/Thal East', NULL, 'URS/Thal East');

-- Row 7: T-202 / Gurgalot X-1 (No fiscal year plans shown in image)

-- Row 8: CCDC-31 / Jakhro North-1
INSERT INTO FiscalYearPlan (FY, QTR, WellName, WellDepth, PlanDetails) VALUES
('2025-26', '2nd QTR', 'Bobi-11', NULL, NULL),
('2025-26', '4th QTR', 'Dars W-3', '2000 M', NULL);

-- Row 9: HL-5 / QP-64
INSERT INTO FiscalYearPlan (FY, QTR, WellName, WellDepth, PlanDetails) VALUES
('2025-26', '2nd QTR', 'Pasakhi-13', '3045 M', '29-06-2025'),
('2025-26', '3rd QTR', 'Chak 63-2', NULL, 'W/O');

-- Row 10: N-55 / Dars Deep-1A (RE)
INSERT INTO FiscalYearPlan (FY, QTR, WellName, WellDepth, PlanDetails) VALUES
('2025-26', '1st QTR', 'KNR-8', NULL, 'W/O'),
('2025-26', '1st QTR', 'CNS-1', NULL, 'W/O'),
('2025-26', '1st QTR', 'CNS-2', NULL, 'W/O'),
('2025-26', '2nd QTR', 'CNS-1 A', NULL, 'W/O'),
('2025-26', '2nd QTR', 'Kal-3', NULL, 'W/O'),
('2025-26', '3rd QTR', 'Nim X-1', '2500 M', NULL);

-- Row 11: SK-750 / KNR-3 (W/O)
INSERT INTO FiscalYearPlan (FY, QTR, WellName, WellDepth, PlanDetails) VALUES
('2025-26', '1st QTR', 'KNR-3', NULL, 'W/O'),
('2025-26', '1st QTR', 'TDM-17', NULL, 'W/O'),
('2025-26', '1st QTR', 'Thora E-1', NULL, 'W/O'),
('2025-26', '2nd QTR', 'TAY WDW-1', '1000 M', NULL);

-- Row 12: N-3 / Toot Deep-1 (W/O)
INSERT INTO FiscalYearPlan (FY, QTR, WellName, WellDepth, PlanDetails) VALUES
('2025-26', '1st QTR', 'Chanda-2', NULL, 'CD-1 (W/O)'),
('2025-26', '1st QTR', 'FimKassar-4', '3100 M', 'R/E'),
('2025-26', '2nd QTR', 'Toot 10A', NULL, 'W/O'),
('2025-26', '3rd QTR', 'Toot 1A', NULL, 'W/O');

-- Row 13: N-4 / Rajian-9
INSERT INTO FiscalYearPlan (FY, QTR, WellName, WellDepth, PlanDetails) VALUES
('2025-26', '1st QTR', 'Rajian-9', NULL, 'WO'),
('2025-26', '1st QTR', 'Rajian-8', NULL, 'WO'),
('2025-26', '1st QTR', 'Rajian-10', NULL, 'WO'),
('2025-26', '2nd QTR', 'Rajian-4A', NULL, 'WO'),
('2025-26', '2nd QTR', 'Rajian-6', NULL, 'WO'),
('2025-26', '3rd QTR', 'UCH WDW-1', NULL, NULL),
('2025-26', '3rd QTR', 'Mari East X-1', NULL, NULL),
('2025-26', '4th QTR', 'Dhodhak Deep-1', NULL, NULL);

PRINT 'Comprehensive fiscal year plans inserted successfully.'

-- Verify the data
PRINT 'Verifying data...'
SELECT COUNT(*) as TotalFiscalYearPlans FROM FiscalYearPlan;
SELECT QTR, COUNT(*) as WellsInQuarter FROM FiscalYearPlan GROUP BY QTR ORDER BY QTR;

PRINT 'Database update completed successfully!'
PRINT 'You can now restart your Python backend and the frontend should work properly.'
PRINT 'The fiscal year plans will be displayed for each well in the dashboard.'











--------------------
-- Add WellID to FiscalYearPlan
ALTER TABLE FiscalYearPlan ADD WellID INT NULL;

-- For each well, update FiscalYearPlan.WellID based on WellName
UPDATE FiscalYearPlan
SET WellID = w.WellID
FROM FiscalYearPlan f
JOIN Well w ON f.WellName = w.WellName;

SELECT * FROM Well
SELECT * FROM FiscalYearPlan

-- (Optional) Remove WellName column after migration
-- ALTER TABLE FiscalYearPlan DROP COLUMN WellName;

-- Enforce one plan per well per quarter
ALTER TABLE FiscalYearPlan
ADD CONSTRAINT uq_FY_Well_Quarter UNIQUE (FY, WellID, QTR);

-- Now, for each well, ensure there is at most one row per quarter.
-- (Manually review and clean up duplicates if any.)


-- Example: (fill in the correct WellID for each)
UPDATE FiscalYearPlan SET WellID = 3 WHERE WellName = 'Bitrism East-1';
UPDATE FiscalYearPlan SET WellID = 10 WHERE WellName = 'Dars Deep-1 (R/E)';
UPDATE FiscalYearPlan SET WellID = 4 WHERE WellName = 'Chakar-1';
UPDATE FiscalYearPlan SET WellID = 5 WHERE WellName = 'Pasakhi-14';
UPDATE FiscalYearPlan SET WellID = 6 WHERE WellName = 'Khatian-1';
UPDATE FiscalYearPlan SET WellID = 8 WHERE WellName = 'Jakhro North-1';
UPDATE FiscalYearPlan SET WellID = 9 WHERE WellName = 'QP-64';
UPDATE FiscalYearPlan SET WellID = 11 WHERE WellName = 'KNR-3 (W/O)';
UPDATE FiscalYearPlan SET WellID = 12 WHERE WellName = 'Toot Deep-1';
UPDATE FiscalYearPlan SET WellID = 13 WHERE WellName = 'Rajian-9';
-- And so on for every unique WellName in FiscalYearPlan



-- Dars Deep-1 (R/E) → Dars Deep-1A (RE) (WellID 10)
UPDATE FiscalYearPlan SET WellID = 10 WHERE WellName = 'Dars Deep-1 (R/E)';

-- Rajian-9 → Rajian-9 (WellID 13)
UPDATE FiscalYearPlan SET WellID = 13 WHERE WellName = 'Rajian-9';

-- Bitrism East-1 → Bitrism East-1 (WellID 3)
UPDATE FiscalYearPlan SET WellID = 3 WHERE WellName = 'Bitrism East-1';

-- Chakar-1 → Chakar-1 (WellID 4)
UPDATE FiscalYearPlan SET WellID = 4 WHERE WellName = 'Chakar-1';

-- Pasakhi-14 → Pasakhi-14 (WellID 5)
UPDATE FiscalYearPlan SET WellID = 5 WHERE WellName = 'Pasakhi-14';

-- Khatian-1 → Khatian-1 (WellID 6)
UPDATE FiscalYearPlan SET WellID = 6 WHERE WellName = 'Khatian-1';

-- Gurgalot X-1 → Gurgalot X-1 (WellID 7)
UPDATE FiscalYearPlan SET WellID = 7 WHERE WellName = 'Gurgalot X-1';

-- Jakhro North-1 → Jakhro North-1 (WellID 8)
UPDATE FiscalYearPlan SET WellID = 8 WHERE WellName = 'Jakhro North-1';

-- QP-64 → QP-64 (WellID 9)
UPDATE FiscalYearPlan SET WellID = 9 WHERE WellName = 'QP-64';

-- KNR-3 (W/O) → KNR-3 (W/O) (WellID 11)
UPDATE FiscalYearPlan SET WellID = 11 WHERE WellName = 'KNR-3 (W/O)';

-- Toot Deep-1 → Toot Deep-1 (WellID 12)
UPDATE FiscalYearPlan SET WellID = 12 WHERE WellName = 'Toot Deep-1';

-- Rajian-8, Rajian-10, Rajian-4A, Rajian-6 (no direct match, likely related to Rajian-9, but not in Well table)
-- Bobi-11, Dars W-3, Pasakhi-13, Chak 63-2, KNR-8, CNS-1, CNS-2, CNS-1 A, Kal-3, Nim X-1, TDM-17, Thora E-1, TAY WDW-1, Chanda-2, FimKassar-4, Toot 10A, Toot 1A, UCH WDW-1, Mari East X-1, Dhodhak Deep-1, etc. (no match in Well table)

-- If you want to add these as wells, insert them into the Well table and then update their WellID here.

-- Example for adding a missing well and updating:
-- INSERT INTO Well (WellName, BlockID) VALUES ('Rajian-8', 10); -- Use correct BlockID
-- DECLARE @newId INT = SCOPE_IDENTITY();
-- UPDATE FiscalYearPlan SET WellID = @newId WHERE WellName = 'Rajian-8';

-- Repeat for any other missing wells you want to add.

-- Verify results
SELECT FiscalYearPlanID, WellName, WellID FROM FiscalYearPlan ORDER BY FiscalYearPlanID;


  DELETE FROM FiscalYearPlan;

  -- CCDC-32 / Bitrism East-1 (WellID 3)
INSERT INTO FiscalYearPlan (FY, QTR, WellName, WellDepth, PlanDetails, WellID) VALUES
('2025-26', '2nd QTR', 'KNR Deep-12', '4000 M', 'KNR Deep-12 (4000 M)', 3),
('2025-26', '4th QTR', 'Sinjhoro W-1', '3880 M', 'Sinjhoro W-1 (3880 M)', 3);

-- N-5 / Chakar-1 (WellID 4)
INSERT INTO FiscalYearPlan (FY, QTR, WellName, WellDepth, PlanDetails, WellID) VALUES
('2025-26', '1st QTR', 'Dars Deep-1 (R/E)', '3350 M', 'Dars Deep-1 (R/E) (3350 M) 30-06-2025', 10), -- Dars Deep-1A (RE) is WellID 10
('2025-26', '2nd QTR', 'Thal West-1A', NULL, 'Thal West-1A', 4),
('2025-26', '3rd QTR', 'KNR WIW', NULL, 'KNR WIW', 4),
('2025-26', '3rd QTR', 'Chak 63-5', '3500 M', 'Chak 63-5 (3500 M)', 4),
('2025-26', '4th QTR', 'Sinjhoro X-1', '3880 M', 'Sinjhoro X-1 (3880 M)', 4);

-- N-6 / Pasakhi-14 (WellID 5)
INSERT INTO FiscalYearPlan (FY, QTR, WellName, WellDepth, PlanDetails, WellID) VALUES
('2025-26', '1st QTR', 'Jand-1', NULL, 'Jand-1 (W/O)', 5),
('2025-26', '2nd QTR', 'Jandran W-2', '1900 M', 'Jandran W-2 (1900 M)', 5),
('2025-26', '3rd QTR', 'Lakhi Rud X-1', '2500 M', 'Lakhi Rud X-1 (2500 M)', 5),
('2025-26', '4th QTR', 'Kalerishum-A1', '2500 M', 'Kalerishum-A1 (2500 M)', 5);

-- N-2 / Khatian-1 (WellID 6)
INSERT INTO FiscalYearPlan (FY, QTR, WellName, WellDepth, PlanDetails, WellID) VALUES
('2025-26', '1st QTR', 'Chandio-1', NULL, 'Chandio-1 (W/O)', 6),
('2025-26', '2nd QTR', 'Gaja wah-1', NULL, 'Gaja wah-1 (W/O)', 6),
('2025-26', '3rd QTR', 'Katiar-1', NULL, 'Katiar-1 (W/O)', 6),
('2025-26', '4th QTR', 'Baloch-1', NULL, 'Baloch-1 (Sembar)', 6),
('2025-26', '4th QTR', 'URS/Thal East', NULL, 'URS/Thal East', 6);

-- CCDC-31 / Jakhro North-1 (WellID 8)
INSERT INTO FiscalYearPlan (FY, QTR, WellName, WellDepth, PlanDetails, WellID) VALUES
('2025-26', '2nd QTR', 'Bobi-11', NULL, NULL, 8),
('2025-26', '4th QTR', 'Dars W-3', '2000 M', NULL, 8);

-- HL-5 / QP-64 (WellID 9)
INSERT INTO FiscalYearPlan (FY, QTR, WellName, WellDepth, PlanDetails, WellID) VALUES
('2025-26', '2nd QTR', 'Pasakhi-13', '3045 M', '29-06-2025', 9),
('2025-26', '3rd QTR', 'Chak 63-2', NULL, 'W/O', 9);

-- N-55 / Dars Deep-1A (RE) (WellID 10)
INSERT INTO FiscalYearPlan (FY, QTR, WellName, WellDepth, PlanDetails, WellID) VALUES
('2025-26', '1st QTR', 'KNR-8', NULL, 'W/O', 10),
('2025-26', '1st QTR', 'CNS-1', NULL, 'W/O', 10),
('2025-26', '1st QTR', 'CNS-2', NULL, 'W/O', 10),
('2025-26', '2nd QTR', 'CNS-1 A', NULL, 'W/O', 10),
('2025-26', '2nd QTR', 'Kal-3', NULL, 'W/O', 10),
('2025-26', '3rd QTR', 'Nim X-1', '2500 M', NULL, 10);

-- SK-750 / KNR-3 (W/O) (WellID 11)
INSERT INTO FiscalYearPlan (FY, QTR, WellName, WellDepth, PlanDetails, WellID) VALUES
('2025-26', '1st QTR', 'KNR-3', NULL, 'W/O', 11),
('2025-26', '1st QTR', 'TDM-17', NULL, 'W/O', 11),
('2025-26', '1st QTR', 'Thora E-1', NULL, 'W/O', 11),
('2025-26', '2nd QTR', 'TAY WDW-1', '1000 M', NULL, 11);

-- N-3 / Toot Deep-1 (WellID 12)
INSERT INTO FiscalYearPlan (FY, QTR, WellName, WellDepth, PlanDetails, WellID) VALUES
('2025-26', '1st QTR', 'Chanda-2', NULL, 'CD-1 (W/O)', 12),
('2025-26', '1st QTR', 'FimKassar-4', '3100 M', 'R/E', 12),
('2025-26', '2nd QTR', 'Toot 10A', NULL, 'W/O', 12),
('2025-26', '3rd QTR', 'Toot 1A', NULL, 'W/O', 12);

INSERT INTO FiscalYearPlan (FY, QTR, WellName, WellDepth, PlanDetails, WellID) VALUES
('2025-26', '3rd QTR', 'UCH WDW-1', NULL, 'W/O', 12);

-- N-4 / Rajian-9 (WellID 13)
INSERT INTO FiscalYearPlan (FY, QTR, WellName, WellDepth, PlanDetails, WellID) VALUES
('2025-26', '1st QTR', 'Rajian-9', NULL, 'WO', 13),
('2025-26', '1st QTR', 'Rajian-8', NULL, 'WO', 13),
('2025-26', '1st QTR', 'Rajian-10', NULL, 'WO', 13),
('2025-26', '2nd QTR', 'Rajian-4A', NULL, 'WO', 13),
('2025-26', '2nd QTR', 'Rajian-6', NULL, 'WO', 13);

INSERT INTO FiscalYearPlan (FY, QTR, WellName, WellDepth, PlanDetails, WellID) VALUES
('2025-26', '3rd QTR', 'Mari East X-1', NULL, 'WO', 13);
INSERT INTO FiscalYearPlan (FY, QTR, WellName, WellDepth, PlanDetails, WellID) VALUES
('2025-26', '4th QTR', 'Dhodhak Deep-1', NULL, 'WO', 13);

select * from FiscalYearPlan
select * from Well

-- The following plans do not have a matching WellID in your Well table and are left as NULL:
-- ('2025-26', '3rd QTR', 'UCH WDW-1', NULL, NULL, NULL),
-- ('2025-26', '3rd QTR', 'Mari East X-1', NULL, NULL, NULL),
-- ('2025-26', '4th QTR', 'Dhodhak Deep-1', NULL, NULL, NULL),
-- Add these wells to the Well table if you want to map them.

-- You can repeat this pattern for any other wells you add in the future.


-- Deprecate history model and PastWell table (if present)
IF OBJECT_ID('dbo.DrillingOperationHistory', 'U') IS NOT NULL
BEGIN
    PRINT 'Dropping deprecated table DrillingOperationHistory...'
    DROP TABLE dbo.DrillingOperationHistory;
END

IF OBJECT_ID('dbo.PastWell', 'U') IS NOT NULL
BEGIN
    PRINT 'Dropping deprecated table PastWell...'
    DROP TABLE dbo.PastWell;
END


-- Ensure GeneralNotes exists only once on DrillingOperation
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'[dbo].[DrillingOperation]') 
      AND name = 'GeneralNotes'
)
BEGIN
    ALTER TABLE DrillingOperation ADD GeneralNotes NVARCHAR(MAX) NULL;
END

Select * From DrillingOperation

Select * From FiscalYearPlan

SELECT TOP 1 * FROM DrillingOperation;

    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'DrillingOperation'
   
  Select * FROM FiscalYearPlan
 
SELECT FiscalYearPlanID, FY, QTR, WellName, WellDepth, PlanDetails, WellID
FROM FiscalYearPlan F
Where F.WellID = 1




    -------------------------------------------------------------------------
  -------------------------------------------------------------------------
  USE [ORM DRILLING OPERATIONS]

-- Check if GeneralNotes column exists in DrillingOperation table
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[DrillingOperation]') AND name = 'GeneralNotes')
BEGIN
    PRINT 'Adding GeneralNotes column to DrillingOperation table...'
    ALTER TABLE DrillingOperation ADD GeneralNotes NVARCHAR(MAX) NULL;
    PRINT 'GeneralNotes column added successfully.'
END
ELSE
BEGIN
    PRINT 'GeneralNotes column already exists in DrillingOperation table.'
END

-- Verify GeneralNotes column exists
PRINT 'Verifying columns...'
SELECT 
    CASE WHEN EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[DrillingOperation]') AND name = 'GeneralNotes')
         THEN 'GeneralNotes exists in DrillingOperation'
         ELSE 'GeneralNotes MISSING in DrillingOperation'
    END as DrillingOperationStatus;

-- Ensure Well has status columns in existing DBs
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'[dbo].[Well]') AND name = 'IsActive'
)
BEGIN
    ALTER TABLE Well ADD IsActive BIT NOT NULL CONSTRAINT DF_Well_IsActive DEFAULT(1);
END
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'[dbo].[Well]') AND name = 'DeactivatedAt'
)
BEGIN
    ALTER TABLE Well ADD DeactivatedAt DATETIME NULL;
END

-- Show all columns in DrillingOperation table to confirm
PRINT 'Current columns in DrillingOperation table:'
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'DrillingOperation'
ORDER BY ORDINAL_POSITION;



-----------------
