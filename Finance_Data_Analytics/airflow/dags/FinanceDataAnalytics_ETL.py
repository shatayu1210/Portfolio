# -*- coding: utf-8 -*-
"""FinanceDataAnalytics_ETL.ipynb
"""

# Importing necessary modules
from airflow import DAG
from airflow.models import Variable
from airflow.models import DagRun
from airflow.decorators import task
from airflow.providers.snowflake.hooks.snowflake import SnowflakeHook
import snowflake.connector
import requests
from datetime import datetime, timedelta
from airflow.operators.dagrun_operator import TriggerDagRunOperator

# Slack notification function
def send_slack_notification(message: str):
    webhook_url = Variable.get("SLACK_WEBHOOK_URL")
    payload = {"text": message}
    requests.post(webhook_url, json=payload)


# Notification functions for DAG callbacks
def notify_success(context):
    send_slack_notification(f"DAG {context['dag'].dag_id} succeeded!")


def notify_failure(context):
    send_slack_notification(f"DAG {context['dag'].dag_id} failed. Check logs for details.")


def notify_retry(context):
    send_slack_notification(f"DAG {context['dag'].dag_id} is retrying...")


def return_snowflake_conn():
    hook = SnowflakeHook(snowflake_conn_id='snowflake_conn') # Initialize the SnowflakeHook
    conn = hook.get_conn()
    return conn, conn.cursor() # Returning connection (to close it once database operations are done) as well as cursor object (to operate on databases)


# Creating Function to read stock prices based on symbol provided
@task
def extract_stock_data(symbol):
    if(symbol == "AAPL"):
        print("Starting Extraction for Apple Stock Data...")
    elif(symbol == "NVDA"):
        print("Starting Extraction for NVIDIA Stock Data...")
    vantage_api_key = Variable.get('vantage_api_key')
    url = f"https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol={symbol}&apikey={vantage_api_key}"
    r = requests.get(url)
    data = (r.json())  # Storing all data for given symbol in json form, fetched from alpha vantage api
    print("<---------- Last Refreshed:",data['Meta Data']['3. Last Refreshed'],"\n\nSymbol:",data['Meta Data']['2. Symbol'],"---------->")
    results = []  # Initializing empty list
    for d in data["Time Series (Daily)"]:  # Here the keys under 'Time Series (Daily)' are stored, which are the dates
        stock_info = data["Time Series (Daily)"][d]  # This stores the stock prices info for each iterated date
        stock_info["date"] = d  # Creating another key value pair for date to the end of stock_info dictionary
        results.append(stock_info)  # Each stock_info instance of dictionary that holds the stock prices along with that particular date is added to results list
    print("Stock Data Extraction Complete\n")
    return results


# Transforming stock data to return only 90d data
@task
def transform_to_90d_stock_data(results):
    print("Transforming the Extracted Stock Data...")
    today = datetime.now().date()  # Get today's date
    ninety_days_ago = today - timedelta(days=90)  # Calculate the date 90 days ago

    # Filter results for the last 90 days
    filtered_results = [
        entry
        for entry in results
        if datetime.strptime(entry["date"], "%Y-%m-%d").date() >= ninety_days_ago
    ]
    print("Completed Transforming Stock Data\n")
    return filtered_results


# Loading last 90d data for both stocks into Snowflake table
@task
def load_stock_data(table, apple_results, nvidia_results):
    try:
        conn, cursor = return_snowflake_conn()  # Initialize Snowflake connection and cursor
        cursor.execute("BEGIN;")  # Start the SQL transaction (Idempotency)

        # Create table as part of the transaction
        table_create = f"""
        CREATE OR REPLACE TABLE {table} (
            date TIMESTAMP_NTZ NOT NULL,
            open FLOAT NOT NULL,
            high FLOAT NOT NULL,
            low FLOAT NOT NULL,
            close FLOAT NOT NULL,
            volume INT NOT NULL,
            symbol STRING NOT NULL,
            PRIMARY KEY (date, symbol)  -- Define composite primary key
        );
        """
        cursor.execute(table_create)  # Executing create_table query
        print("Target Table Initialized and Ready to Store Data from ETL")

        # Below nested function handles insert for each symbol
        def insert_stock_data(results, symbol):
            for r in results:
                open = r["1. open"]
                high = r["2. high"]
                low = r["3. low"]
                close = r["4. close"]
                volume = r["5. volume"]
                date = r["date"]

                # Using MERGE to handle existing records for each symbol based on dates
                merge_sql = f"""
                MERGE INTO {table} AS target
                USING (SELECT '{date}' AS date, '{open}' AS open, '{high}' AS high, '{low}' AS low, '{close}' AS close, '{volume}' AS volume, '{symbol}' AS symbol) AS source
                ON target.symbol = source.symbol AND target.date = source.date
                WHEN MATCHED THEN
                    UPDATE SET
                        open = source.open,
                        high = source.high,
                        low = source.low,
                        close = source.close,
                        volume = source.volume
                WHEN NOT MATCHED THEN
                    INSERT (date, open, high, low, close, volume, symbol)
                    VALUES (source.date, source.open, source.high, source.low, source.close, source.volume, source.symbol);
                """
                cursor.execute(merge_sql)

        # Loading data for APPLE and NVIDIA Stocks
        print("Loading Apple stock data...")
        insert_stock_data(apple_results, "AAPL")

        print("Loading Nvidia stock data...")
        insert_stock_data(nvidia_results, "NVDA")

        cursor.execute("COMMIT;")  # Commit the transaction if the loads were successful
        print("Data load complete for Apple and Nvidia stocks.")
        
    except Exception as e:
        cursor.execute("ROLLBACK;")  # Roll back the transaction in case of any error to preserve the former contents
        print(f"An error occurred during stock data load: {e}")
    
    finally: # Closing snowflake cursor and connection for efficient resource management
        cursor.close()
        conn.close()


# Setting up DAG with Parameters
with DAG(
    dag_id="Stock_Data_ETL",
    default_args={
        "owner": "Shatayu",
        "email": ["shatayu.thakur@sjsu.edu"],
        "email_on_failure": True,
        "email_on_retry": True,
        "email_on_success": True,
        "on_failure_callback": notify_failure,
        "on_success_callback": notify_success,
        "on_retry_callback": notify_retry,
        "retries": 1,
        "retry_delay": timedelta(minutes=5),
    },
    start_date=datetime(2024, 10, 12),
    catchup=False,
    tags=["ETL"],
    schedule_interval='30 21 * * *',  # This will run daily at 2:30 PM PT i.e. API Refresh Time
) as dag:

    # Setting Variables for ETL
    target_table = "dev.raw_data.stock_data"
    symbol_apple = "AAPL"
    symbol_nvidia = "NVDA"

    # Performing Extract and Transform for APPLE and NVIDIA Stock Data
    apple_data = extract_stock_data(symbol_apple)
    nvidia_data = extract_stock_data(symbol_nvidia)
    transformed_apple = transform_to_90d_stock_data(apple_data)
    transformed_nvidia = transform_to_90d_stock_data(nvidia_data)

    # Loading data for APPLE and NVIDIA stocks
    load_data = load_stock_data(target_table, transformed_apple, transformed_nvidia)

    # Triggering the Stock_Prediction DAG on success
    trigger_prediction_task = TriggerDagRunOperator(
        task_id='trigger_stock_prediction',
        trigger_dag_id='Stock_Prediction',
        conf={},  # Pass any configuration needed by the triggered DAG
        wait_for_completion=True,  # Optionally wait for the triggered DAG to complete
    )

    # Task dependencies
    [transformed_apple, transformed_nvidia] >> load_data >> trigger_prediction_task