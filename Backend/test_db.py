from dotenv import load_dotenv
load_dotenv()
import os
from sqlalchemy import create_engine, text
engine = create_engine(os.getenv('DATABASE_URL'))
with engine.connect() as conn:
    conn.execute(text('SELECT 1'))
    print('Connected successfully!')