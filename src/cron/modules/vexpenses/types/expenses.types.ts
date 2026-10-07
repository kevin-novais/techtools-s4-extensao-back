export type VexpensesTeamMember = {
  id: number;
  integration_id: string;
  external_id: string | null;
  company_id: number;
  role_id: number;
  approval_flow_id: number | null;
  expense_limit_policy_id: number | null;
  user_type: string;
  name: string;
  email: string;
  cpf: string | null;
  phone1: string | null;
  phone2: string | null;
  birth_date: string | null;
  bank: string | null;
  agency: string | null;
  account: string | null;
  pix_key: string | null;
  confirmed: boolean;
  active: boolean;
  parameters: {
    base: string | null;
  };
  created_at: string;
  updated_at: string;
};

export type VexpensesExpenseType = {
  id: number;
  integration_id: string;
  description: string;
  on: boolean;
};

export type VexpensesCostCenter = {
  id: number;
  integration_id: string | null;
  name: string;
  company_group_id: number;
  on: boolean;
  approval_flow_id: number | null;
};

export type VexpensesReportStatus =
  | "ABERTO"
  | "APROVADO"
  | "REPROVADO"
  | "PAGO"
  | "ENVIADO";

export type VexpensesReport = {
  id: number;
  external_id: string | null;
  user_id: number;
  device_id: number | null;
  description: string;
  status: VexpensesReportStatus;
  approval_stage_id: number | null;
  approval_user_id: number | null;
  approval_date: string | null;
  payment_date: string | null;
  payment_method_id: number | null;
  observation: string | null;
  paying_company_id: number | null;
  on: boolean;
  justification: string | null;
  pdf_link: string | null;
  excel_link: string | null;
  created_at: string;
  updated_at: string;
};

export type VexpensesReportExpense = {
  id: number;
  user_id: number;
  expense_id: number;
  device_id: number | null;
  integration_id: string | null;
  external_id: string | null;
  mileage: string;
  date: string;
  expense_type_id: number;
  payment_method_id: number | null;
  paying_company_id: number | null;
  course_id: number | null;
  reicept_url: string | null;
  value: number;
  title: string;
  validate: string;
  reimbursable: boolean;
  observation: string | null;
  rejected: number;
  on: boolean;
  mileage_value: string;
  original_currency_iso: string | null;
  exchange_rate: string | null;
  converted_value: string | null;
  converted_currency_iso: string | null;
  created_at: string;
  updated_at: string;
};

export type VexpensesGroupedExpense = VexpensesReportExpense & {
  cost_center_integration_id: string;
  codigo_cia: string;
  nome_colaborador: string | null;
};

export type VexpensesReportWithExpenses = VexpensesReport & {
  expenses:
    | {
        data: VexpensesReportExpense[];
      }
    | VexpensesReportExpense[];
};

export type VexpensesPayReportPayload = {
  payment_date: string;
  comment: string;
};

export type VexpensesGroupedReports = Record<
  number,
  {
    reports: VexpensesReportWithExpenses[];
    count: number;
  }
>;

export type VexpensesGroupedExpensesByCardCodeAndCompany = Record<
  string,
  Record<
    string,
    {
      reportsCount: number;
      reports: Record<
        number,
        {
          expenses: VexpensesGroupedExpense[];
          expensesCount: number;
        }
      >;
    }
  >
>;

export type VexpensesIntegrationLancamento = {
  conta: string;
  centroCusto: string;
  valor: number;
};

export type VexpensesIntegrationAnexo = {
  nomeAnexo: string;
  localAnexo: string;
};

export type VexpensesIntegrationJson = {
  tipoArApGl: string;
  tipoDocumento: string;
  codigoCia: string;
  numeroDocumento: string;
  textoDocumento: string;
  valorDocumento: number;
  codigoParceiro: string;
  dataEmissao: string;
  dataVencimento: string;
  condicaoPagto: string;
  dataLancamento: string;
  usuarioLancamento: string;
  lancamentosContabeis: VexpensesIntegrationLancamento[];
  anexos: VexpensesIntegrationAnexo[];
};

export type VexpensesApprovedReportsResult = {
  groupedExpenses: VexpensesGroupedExpensesByCardCodeAndCompany;
  integracoes: VexpensesIntegrationJson[];
};
