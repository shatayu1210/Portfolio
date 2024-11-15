# -*- coding: utf-8 -*-
"""FinanceDataAnalytics_Prediction.ipynb
"""

# Importing necessary modules
from airflow import DAG
from airflow.models import Variable
from airflow.decorators import task
from airflow.providers.snowflake.hooks.snowflake import SnowflakeHook
import snowflake.connector
import requests
from datetime import datetime, timedelta
from airflow.models import DagRun
from airflow.operators.dagrun_operator import TriggerDagRunOperator


def return_snowflake_conn():
    hook = SnowflakeHook(snowflake_conn_id='snowflake_conn') # Initialize the SnowflakeHook
    conn = hook.get_conn()
    return conn, conn.cursor() # Created a cursor object to work with databases


# Function to train model based on raw data from ETL executions
@task
def train(train_input_table, train_view, forecast_function_name):
    """
     - Create a view with training related columns
     - Create a model with the view above
    """

    create_view_sql = f"""CREATE OR REPLACE VIEW {train_view} AS SELECT
        DATE, CLOSE, SYMBOL
        FROM {train_input_table};"""

    create_model_sql = f"""CREATE OR REPLACE SNOWFLAKE.ML.FORECAST {forecast_function_name} (
        INPUT_DATA => SYSTEM$REFERENCE('VIEW', '{train_view}'),
        SERIES_COLNAME => 'SYMBOL',
        TIMESTAMP_COLNAME => 'DATE',
        TARGET_COLNAME => 'CLOSE',
        CONFIG_OBJECT => {{ 'ON_ERROR': 'SKIP' }}
    );"""

    try:
        conn, cursor = return_snowflake_conn()
        cursor.execute(create_view_sql)
        cursor.execute(create_model_sql)
        # Inspect the accuracy metrics of your model.
        cursor.execute(f"CALL {forecast_function_name}!SHOW_EVALUATION_METRICS();")
    except Exception as e:
        print(e)
        raise
    finally: # Closing snowflake cursor and connection for efficient resource management
        conn.close()
        cursor.close()


# Function to predict and populate the forecast table based on training data and model
@task
def predict(forecast_function_name, train_input_table, forecast_table, final_table):
    """
     - Generate predictions and store the results to a table named forecast_table.
     - Union your predictions with your historical data, then create the final table
    """
    make_prediction_sql = f"""BEGIN
        -- This is the step that creates your predictions.
        CALL {forecast_function_name}!FORECAST(
            FORECASTING_PERIODS => 7,
            -- Here we set your prediction interval.
            CONFIG_OBJECT => {{'prediction_interval': 0.95}}
        );
        -- These steps store your predictions to a table.
        LET x := SQLID;
        CREATE OR REPLACE TABLE {forecast_table} AS SELECT * FROM TABLE(RESULT_SCAN(:x));
    END;"""
    create_final_table_sql = f"""CREATE OR REPLACE TABLE {final_table} AS
        SELECT SYMBOL, DATE, CLOSE AS actual, NULL AS forecast, NULL AS lower_bound, NULL AS upper_bound
        FROM {train_input_table}
        UNION ALL
        SELECT replace(series, '"', '') as SYMBOL, ts as DATE, NULL AS actual, forecast, lower_bound, upper_bound
        FROM {forecast_table};"""

    try:
        conn, cursor = return_snowflake_conn()
        cursor.execute(make_prediction_sql)
        cursor.execute(create_final_table_sql)
    except Exception as e:
        print(e)
        raise
    finally: # Closing snowflake cursor and connection for efficient resource management
        conn.close()
        cursor.close()

# Setting up DAG for Training and Prediction with Parameters
with DAG(
    dag_id="Stock_Prediction",
    default_args={
        "owner": "Shatayu",
        "email": ["shatayu.thakur@sjsu.edu"],
        "email_on_failure": True,
        "email_on_retry": True,
        "email_on_success": True,
        "retries": 1,
        "retry_delay": timedelta(minutes=5),
    },
    start_date=datetime(2024, 10, 9),
    catchup=False,
    tags=["ML"],
    schedule_interval=None,  # Being called through Stock_Data_ETL,
) as dag:
    # Setting Variables for Stock Price Prediction
    train_input_table = "dev.raw_data.stock_data"
    train_view = "dev.adhoc.stock_data_view"
    forecast_table = "dev.adhoc.stock_data_forecast"
    forecast_function_name = "dev.analytics.predict_stock_price"
    final_table = "dev.analytics.final_stock_data"

    # Executing Training and Prediction for Apple, NVIDIA Stock Data
    train_task = train(train_input_table, train_view, forecast_function_name)
    predict_task = predict(forecast_function_name, train_input_table, forecast_table, final_table)

     # Triggering the Stock_ELT_dbt DAG on success
    trigger_elt_task = TriggerDagRunOperator(
        task_id='trigger_elt_dag',
        trigger_dag_id='Stock_Data_ELT',
        conf={},  # Pass any configuration needed by the triggered DAG
        wait_for_completion=True,  # Optionally wait for the triggered DAG to complete
    )
    
    # Task dependencies
    train_task >> predict_task >> trigger_elt_task