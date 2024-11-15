"""
dbt DAG to summarize Historical(ETL) and Predicted(ML Forecast) Stock Data through commands via the BashOperator
"""
from pendulum import datetime

from airflow import DAG
from airflow.operators.bash import BashOperator #To help us execute bash commands for dbt
from airflow.hooks.base import BaseHook
import logging

DBT_PROJECT_DIR = "/home/airflow/gcs/dbt_fda" # Pointing to Google Cloud Storage for Google Composer Setup

conn = BaseHook.get_connection('snowflake_conn')

with DAG(
    "Stock_Data_ELT",
    start_date=datetime(2024, 11, 10),
    description="DAG to invoke dbt runs using a BashOperator",
    schedule=None,
    catchup=False,
    tags=["ELT"],
    default_args={
        "email": ["shatayu.thakur@sjsu.edu"],
        "owner": "Shatayu",
        "env": {
            "DBT_USER": conn.login,
            "DBT_PASSWORD": conn.password,
            "DBT_ACCOUNT": conn.extra_dejson.get("account"),
            "DBT_SCHEMA": conn.schema,
            "DBT_DATABASE": conn.extra_dejson.get("database"),
            "DBT_ROLE": conn.extra_dejson.get("role"),
            "DBT_WAREHOUSE": conn.extra_dejson.get("warehouse"),
            "DBT_TYPE": "snowflake"
        }
    },
) as dag:
    
    dbt_run = BashOperator(
        task_id='dbt_run',
        bash_command=f"""
        mkdir -p /home/airflow/gcs/dbt_fda && \
        gcloud storage cp --recursive gs://us-central1-lab-env-7a01fe31-bucket/dbt_fda /home/airflow/gcs/ && \
        cd /home/airflow/gcs/dbt_fda && \
        /opt/python3.11/bin/dbt run --profiles-dir {DBT_PROJECT_DIR} --project-dir {DBT_PROJECT_DIR}
        """
    )

    dbt_test = BashOperator(
        task_id="dbt_test",
        bash_command=f"/opt/python3.11/bin/dbt test --profiles-dir {DBT_PROJECT_DIR} --project-dir {DBT_PROJECT_DIR}",
    )

    dbt_snapshot = BashOperator(
        task_id="dbt_snapshot",
        bash_command=f"/opt/python3.11/bin/dbt snapshot --profiles-dir {DBT_PROJECT_DIR} --project-dir {DBT_PROJECT_DIR}",
    )

    # Task Dependencies
    dbt_run >> dbt_test >> dbt_snapshot
