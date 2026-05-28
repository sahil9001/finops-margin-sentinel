export interface MarginRow {
  email: string;
  customer_name: string;
  monthly_revenue: number;
  total_token_cost: number;
  ai_features_clicked: number;
  net_margin: number;
  status: 'healthy' | 'warning' | 'leak';
}

export interface AuditResult {
  clientEmail: string;
  clientName: string;
  margin: number;
  reasoning: string[];
  suggestedAction: string;
  emailDraft: {
    subject: string;
    body: string;
  };
}
