// Type definitions for MCP tool responses

export interface ListTableResponse {
  success: boolean;
  message: string;
  tables: string[];
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: string;
  default: string | null;
}

export interface DescribeTableResponse {
  success: boolean;
  columns: ColumnInfo[];
}

export interface ReadDataResponse {
  success: boolean;
  message: string;
  data: Record<string, unknown>[];
  recordCount: number;
}
