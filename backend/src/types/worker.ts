export interface WorkerSummaryDto {
  id: string;
  name: string;
  address: string;
  department: string;
  status: "active" | "inactive";
}

export interface WorkerFullDto extends WorkerSummaryDto {
  employerAddress: string;
  bankAccountStub?: string | null;
  personalIdentifier?: string | null;
  email?: string | null;
  phone?: string | null;
  metadata?: Record<string, unknown> | null;
}
