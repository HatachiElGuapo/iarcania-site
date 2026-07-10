export interface Budget {
  id: string
  user_id: string
  name: string
  type: 'income' | 'expense'
  amount: number
  priority: number
  is_active: boolean
  month: number
  year: number
  current_spent?: number
}

export interface BudgetDistribution {
  id: string
  income_id: string
  budget_id: string
  amount_assigned: number
  created_at: string
  budget?: Budget
}

export interface Income {
  id: string
  user_id: string
  amount: number
  source: string
  description?: string
  distribution_applied: boolean
  client_id?: string
  project_id?: string
  created_at: string
  budget_distributions?: BudgetDistribution[]
}

export interface Debt {
  id: string
  user_id: string
  creditor: string
  debtor: string
  total_amount: number
  remaining_amount: number
  monthly_payment?: number
  due_date?: string
  status: 'active' | 'paid'
  notes?: string
  created_at: string
}

export interface Client {
  id: string
  user_id?: string
  name: string
  business_name?: string
  phone?: string
  email?: string
  source?: string
  status: 'lead' | 'prospect' | 'active' | 'inactive'
  notes?: string
  created_at: string
}

export interface Deal {
  id: string
  client_id: string
  name: string
  stage: 'contacted' | 'demo' | 'proposal' | 'negotiation' | 'won' | 'lost'
  service_type?: 'custom_agent' | 'family_os'
  value?: number
  anticipo_pct: number
  anticipo_paid: boolean
  expected_close_date?: string
  closed_at?: string
  notes?: string
  created_at: string
  client?: Client
}

export type DistributionPreview = {
  budget_id: string
  budget_name: string
  priority: number
  needed: number
  assigned: number
  already_covered: number
}
