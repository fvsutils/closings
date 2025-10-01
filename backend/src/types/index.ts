export interface Closing {
    id: number;
    date: string;
    code: string;
    value: number;
  }
  
  export interface StockCode {
    code: string;
  }
  
  export interface ApiResponse<T> {
    data?: T;
    error?: string;
  }