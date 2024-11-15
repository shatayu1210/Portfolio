{% snapshot obv_stock_summary_snapshot %}

{{
  config(
    target_schema='analytics',
    unique_key="symbol_date",
    strategy='check',
    check_cols=['close', 'obv'],
    invalidate_hard_deletes=True
  )
}}

select
  concat(symbol, '_', date) as symbol_date, --Since we cannot pass a composite key in pair
  close,
  obv
from {{ source('analytics', 'obv_stock_summary') }}

{% endsnapshot %}