import os
import sqlite3
import re
from datetime import datetime
from functools import lru_cache

# SQL Server settings
server = r'localhost\SQLEXPRESS'
database = 'ORM DRILLING OPERATIONS'
driver = '{ODBC Driver 17 for SQL Server}'

# SQLite fallback path
WORKSPACE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
DB_DIR = os.path.join(WORKSPACE_ROOT, 'db')
SQLITE_DB_PATH = os.path.join(DB_DIR, 'orm_drilling.db')

_connection_pool = []

class SQLiteCursorWrapper:
    def __init__(self, cursor):
        self._cursor = cursor
        self.last_inserted_id = None

    def execute(self, query, params=None):
        if params is None:
            params = ()
        elif isinstance(params, dict):
            # Dict params if any
            pass
        elif not isinstance(params, (list, tuple)):
            params = (params,)

        q = query.strip()

        # Handle T-SQL DDL column checks
        if "IF NOT EXISTS" in q and "sys.columns" in q:
            m = re.search(r"OBJECT_ID\(N'\[dbo\]\.\[(\w+)\]'\)\s+AND\s+name\s+=\s+'(\w+)'", q, re.IGNORECASE)
            if m:
                table, col = m.group(1), m.group(2)
                self._cursor.execute(f"PRAGMA table_info({table});")
                cols = [row[1] for row in self._cursor.fetchall()]
                if col not in cols:
                    alter_match = re.search(r"ALTER TABLE \w+ ADD .*?;", q, re.IGNORECASE | re.DOTALL)
                    if alter_match:
                        try:
                            self._cursor.execute(alter_match.group(0))
                        except Exception:
                            pass
            return self

        if "IF NOT EXISTS" in q and "sys.objects" in q:
            create_match = re.search(r"CREATE TABLE .*?\)", q, re.IGNORECASE | re.DOTALL)
            if create_match:
                c_stmt = create_match.group(0).replace("INT PRIMARY KEY IDENTITY", "INTEGER PRIMARY KEY AUTOINCREMENT")
                try:
                    self._cursor.execute(c_stmt)
                except Exception:
                    pass
            return self

        # Replace T-SQL functions
        q = re.sub(r'GETDATE\(\)', 'datetime("now", "localtime")', q, flags=re.IGNORECASE)
        q = re.sub(r'\bISNULL\(', 'COALESCE(', q, flags=re.IGNORECASE)

        # Handle OUTPUT INSERTED.col
        has_output_inserted = False
        if "OUTPUT INSERTED." in q:
            has_output_inserted = True
            q = re.sub(r'OUTPUT\s+INSERTED\.\w+(\s*,\s*INSERTED\.\w+)*', '', q, flags=re.IGNORECASE)

        # Handle boolean params
        clean_params = [1 if p is True else (0 if p is False else p) for p in params]

        self._cursor.execute(q, clean_params)

        if has_output_inserted and self._cursor.lastrowid:
            self.last_inserted_id = self._cursor.lastrowid

        return self

    def fetchone(self):
        if self.last_inserted_id is not None:
            res = (self.last_inserted_id,)
            self.last_inserted_id = None
            return res
        return self._cursor.fetchone()

    def fetchall(self):
        return self._cursor.fetchall()

    @property
    def description(self):
        return self._cursor.description

class SQLiteConnWrapper:
    def __init__(self, conn):
        self._conn = conn

    def cursor(self):
        return SQLiteCursorWrapper(self._conn.cursor())

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        self._conn.close()

def get_sqlite_connection():
    if not os.path.exists(SQLITE_DB_PATH):
        # Auto seed if missing
        seed_script = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'scratch', 'seed_sqlite.py')
        if os.path.exists(seed_script):
            os.system(f'py -3.13 "{seed_script}"')
    conn = sqlite3.connect(SQLITE_DB_PATH, check_same_thread=False)
    conn.execute("PRAGMA foreign_keys = ON;")
    return SQLiteConnWrapper(conn)

_sql_server_available = None

def get_db_connection():
    global _sql_server_available
    if _connection_pool:
        try:
            conn = _connection_pool.pop()
            conn.cursor().execute("SELECT 1")
            return conn
        except Exception:
            pass

    # Try SQL Server pyodbc connection first if not already known to be unavailable
    if _sql_server_available is not False:
        try:
            import pyodbc
            drivers = pyodbc.drivers()
            sql_driver = None
            for d in ['ODBC Driver 17 for SQL Server', 'ODBC Driver 18 for SQL Server', 'SQL Server']:
                if d in drivers:
                    sql_driver = d
                    break
            if sql_driver:
                conn = pyodbc.connect(f'DRIVER={{{sql_driver}}};SERVER={server};DATABASE={database};Trusted_Connection=yes;', timeout=1)
                _sql_server_available = True
                return conn
        except Exception:
            _sql_server_available = False

    # Fallback to SQLite
    return get_sqlite_connection()

def return_connection(conn):
    try:
        if isinstance(conn, SQLiteConnWrapper):
            conn.close()
            return
        if len(_connection_pool) < 5:
            _connection_pool.append(conn)
        else:
            conn.close()
    except Exception:
        try:
            conn.close()
        except Exception:
            pass
