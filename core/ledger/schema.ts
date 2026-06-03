export type LedgerRow = {
  id: string;
  account: string;
  date: string;
  post_date: string;
  description_raw: string;
  merchant_raw: string;
  amount: string;
  currency: string;
  source_file: string;
  source_hash: string;
  import_time: string;
};

export type ChangeRow = {
  change_id: string;
  transaction_id: string;
  change_type: string;
  field: string;
  value: string;
  time: string;
};
