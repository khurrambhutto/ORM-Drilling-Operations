import pyodbc
import json

def check_database():
    # Database connection settings (same as your main.py)
    server = r'localhost\SQLEXPRESS'
    database = 'ORM DRILLING OPERATIONS'
    driver = '{ODBC Driver 17 for SQL Server}'
    
    try:
        # Connect to database
        conn = pyodbc.connect(f'DRIVER={driver};SERVER={server};DATABASE={database};Trusted_Connection=yes;')
        cursor = conn.cursor()
        print("✅ Successfully connected to SQL Server!")
        print(f"Database: {database}")
        print("=" * 60)
        
        # Get all tables
        print("\n📋 TABLES IN DATABASE:")
        cursor.execute("""
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_TYPE = 'BASE TABLE'
            ORDER BY TABLE_NAME
        """)
        tables = [row[0] for row in cursor.fetchall()]
        
        for i, table in enumerate(tables, 1):
            print(f"{i:2d}. {table}")
        
        # Get detailed structure for each table
        for table_name in tables:
            print(f"\n🏗️  TABLE STRUCTURE: {table_name}")
            print("-" * 50)
            
            # Get column information
            cursor.execute(f"""
                SELECT 
                    COLUMN_NAME,
                    DATA_TYPE,
                    CHARACTER_MAXIMUM_LENGTH,
                    IS_NULLABLE,
                    COLUMN_DEFAULT
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_NAME = '{table_name}'
                ORDER BY ORDINAL_POSITION
            """)
            
            columns = cursor.fetchall()
            print(f"{'Column Name':<20} {'Data Type':<15} {'Max Length':<12} {'Nullable':<10} {'Default':<15}")
            print("-" * 80)
            
            for col in columns:
                col_name = col[0] or ""
                data_type = col[1] or ""
                max_length = str(col[2]) if col[2] else "N/A"
                nullable = col[3] or ""
                default_val = str(col[4]) if col[4] else "None"
                
                print(f"{col_name:<20} {data_type:<15} {max_length:<12} {nullable:<10} {default_val:<15}")
            
            # Get row count
            cursor.execute(f"SELECT COUNT(*) FROM [{table_name}]")
            row_count = cursor.fetchone()[0]
            print(f"\n📊 Total Rows: {row_count}")
            
            # Show sample data if table has data
            if row_count > 0:
                cursor.execute(f"SELECT TOP 3 * FROM [{table_name}]")
                sample_data = cursor.fetchall()
                if sample_data:
                    print(f"\n📋 Sample Data (Top 3 rows):")
                    column_names = [desc[0] for desc in cursor.description]
                    print(f"Columns: {', '.join(column_names)}")
                    for i, row in enumerate(sample_data, 1):
                        row_data = [str(item) if item is not None else "NULL" for item in row]
                        print(f"Row {i}: {row_data}")
            
            print("\n" + "=" * 60)
        
        # Get foreign key relationships
        print("\n🔗 FOREIGN KEY RELATIONSHIPS:")
        print("-" * 50)
        cursor.execute("""
            SELECT 
                fk.name AS FK_Name,
                tp.name AS Parent_Table,
                cp.name AS Parent_Column,
                tr.name AS Referenced_Table,
                cr.name AS Referenced_Column
            FROM sys.foreign_keys fk
            INNER JOIN sys.tables tp ON fk.parent_object_id = tp.object_id
            INNER JOIN sys.tables tr ON fk.referenced_object_id = tr.object_id
            INNER JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
            INNER JOIN sys.columns cp ON fkc.parent_column_id = cp.column_id AND fkc.parent_object_id = cp.object_id
            INNER JOIN sys.columns cr ON fkc.referenced_column_id = cr.column_id AND fkc.referenced_object_id = cr.object_id
            ORDER BY tp.name, cp.name
        """)
        
        fks = cursor.fetchall()
        if fks:
            for fk in fks:
                print(f"{fk[1]}.{fk[2]} -> {fk[3]}.{fk[4]} (FK: {fk[0]})")
        else:
            print("No foreign key relationships found.")
        
        conn.close()
        print("\n✅ Database analysis complete!")
        
    except Exception as e:
        print(f"❌ Error connecting to database: {e}")
        print("\nTroubleshooting tips:")
        print("1. Make sure SQL Server is running")
        print("2. Check if 'ORM DRILLING OPERATIONS' database exists")
        print("3. Verify you have permissions to access the database")
        print("4. Ensure ODBC Driver 17 for SQL Server is installed")

if __name__ == "__main__":
    check_database()
