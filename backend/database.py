import os
from datetime import date, datetime

import psycopg2
from psycopg2.extras import RealDictCursor


DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": os.getenv("DB_PORT", "5432"),
    "database": os.getenv("DB_NAME", "complaints_db"),
    "user": os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", ""),
}


CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS complaints (
    complaint_id SERIAL PRIMARY KEY,
    complaint_source TEXT,
    customer_name TEXT,
    product_name TEXT,
    product_strength_grade TEXT,
    batch_lot_number TEXT,
    manufacturing_date DATE,
    expiry_date DATE,
    quantity_affected TEXT,
    complaint_type TEXT,
    complaint_date DATE,
    detailed_complaint_description TEXT,
    initial_severity TEXT,
    priority TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""


def get_connection():
    return psycopg2.connect(**DB_CONFIG)


def initialize_database():
    connection = get_connection()

    try:
        with connection.cursor() as cursor:
            cursor.execute(CREATE_TABLE_SQL)

        connection.commit()
    finally:
        connection.close()


def _json_safe(value):
    if isinstance(value, (date, datetime)):
        return value.isoformat()

    return value


def _clean_row(row):
    if not row:
        return None

    return {key: _json_safe(value) for key, value in dict(row).items()}


def get_complaint(complaint_id: int):
    connection = get_connection()

    try:
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                "SELECT * FROM complaints WHERE complaint_id = %s",
                (complaint_id,),
            )

            return _clean_row(cursor.fetchone())
    finally:
        connection.close()


def search_complaints(query: str = "", limit: int = 20):
    connection = get_connection()
    query = query.strip()

    try:
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            if query:
                search = f"%{query}%"

                cursor.execute(
                    """
                    SELECT
                        complaint_id,
                        customer_name,
                        product_name,
                        batch_lot_number,
                        complaint_type,
                        complaint_date,
                        created_at
                    FROM complaints
                    WHERE
                        CAST(complaint_id AS TEXT) ILIKE %s
                        OR COALESCE(customer_name, '') ILIKE %s
                        OR COALESCE(product_name, '') ILIKE %s
                        OR COALESCE(batch_lot_number, '') ILIKE %s
                        OR COALESCE(complaint_type, '') ILIKE %s
                    ORDER BY created_at DESC
                    LIMIT %s
                    """,
                    (
                        search,
                        search,
                        search,
                        search,
                        search,
                        limit,
                    ),
                )
            else:
                cursor.execute(
                    """
                    SELECT
                        complaint_id,
                        customer_name,
                        product_name,
                        batch_lot_number,
                        complaint_type,
                        complaint_date,
                        created_at
                    FROM complaints
                    ORDER BY created_at DESC
                    LIMIT %s
                    """,
                    (limit,),
                )

            rows = cursor.fetchall()

            return [_clean_row(row) for row in rows]
    finally:
        connection.close()


def save_complaint(data: dict) -> dict:
    connection = get_connection()

    try:
        with connection.cursor() as cursor:
            cursor.execute(CREATE_TABLE_SQL)

            cursor.execute(
                """
                SELECT complaint_id
                FROM complaints
                WHERE
                    customer_name = %s
                    AND product_name = %s
                    AND batch_lot_number = %s
                    AND complaint_date = %s
                    AND complaint_type = %s
                LIMIT 1
                """,
                (
                    data.get("customer_name") or None,
                    data.get("product_name") or None,
                    data.get("batch_lot_number") or None,
                    data.get("complaint_date") or None,
                    data.get("complaint_type") or None,
                ),
            )

            duplicate = cursor.fetchone()

            if duplicate:
                connection.rollback()

                return {
                    "success": False,
                    "message": (
                        f"Duplicate complaint found. "
                        f"Complaint ID: {duplicate[0]}"
                    ),
                    "complaint_id": duplicate[0],
                }

            cursor.execute(
                """
                INSERT INTO complaints (
                    complaint_source,
                    customer_name,
                    product_name,
                    product_strength_grade,
                    batch_lot_number,
                    manufacturing_date,
                    expiry_date,
                    quantity_affected,
                    complaint_type,
                    complaint_date,
                    detailed_complaint_description,
                    initial_severity,
                    priority
                )
                VALUES (
                    %(complaint_source)s,
                    %(customer_name)s,
                    %(product_name)s,
                    %(product_strength_grade)s,
                    %(batch_lot_number)s,
                    %(manufacturing_date)s,
                    %(expiry_date)s,
                    %(quantity_affected)s,
                    %(complaint_type)s,
                    %(complaint_date)s,
                    %(detailed_complaint_description)s,
                    %(initial_severity)s,
                    %(priority)s
                )
                RETURNING complaint_id
                """,
                {
                    "complaint_source": data.get("complaint_source") or None,
                    "customer_name": data.get("customer_name") or None,
                    "product_name": data.get("product_name") or None,
                    "product_strength_grade": (
                        data.get("product_strength_grade") or None
                    ),
                    "batch_lot_number": data.get("batch_lot_number") or None,
                    "manufacturing_date": (
                        data.get("manufacturing_date") or None
                    ),
                    "expiry_date": data.get("expiry_date") or None,
                    "quantity_affected": data.get("quantity_affected") or None,
                    "complaint_type": data.get("complaint_type") or None,
                    "complaint_date": data.get("complaint_date") or None,
                    "detailed_complaint_description": (
                        data.get("detailed_complaint_description") or None
                    ),
                    "initial_severity": data.get("initial_severity") or None,
                    "priority": data.get("priority") or None,
                },
            )

            complaint_id = cursor.fetchone()[0]

        connection.commit()

        return {
            "success": True,
            "message": "Complaint submitted successfully.",
            "complaint_id": complaint_id,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()
