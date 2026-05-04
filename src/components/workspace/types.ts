export type FieldVm = {
  id: string;
  label: string;
  slug: string;
  type: string;
  description: string;
  editable: boolean;
  isIdField: boolean;
};

export type SheetVm = {
  id: string;
  documentId: string;
  name: string;
  sheetKind: string;
  isSystemReserved: boolean;
  displayOrder: number;
  description: string;
  version: number;
  fields: FieldVm[];
};

export type DocumentVm = {
  id: string;
  title: string;
  description: string;
  classification: string;
  status: string;
  baselineState: string;
  integrityIssueCount: number;
  sheets: SheetVm[];
};

export type GridRowVm = {
  id: string;
  visibleId: string | null;
  canonicalOrder: number;
  version?: number;
  cells: Record<string, unknown>;
};

export type SheetGridVm = {
  sheet: SheetVm;
  fields: FieldVm[];
  rows: GridRowVm[];
};
