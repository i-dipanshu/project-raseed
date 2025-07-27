// Backend API Service for Expense Parser & Analyst Application

// Types for backend API responses
export interface BackendLineItem {
  description: string;
  amount: number;
  category?: string; // New category field from the backend
  allocation_text: string;
  splits: Array<{
    participant: string;
    amount: number;
  }>;
}

export interface BackendExpenseResult {
  participants: string[];
  clean_participants: string[];
  is_shared: boolean;
  expense_type: 'shared' | 'personal';
  line_items: BackendLineItem[];
  total_amount: number;
  processing_time: number;
  status: string;
}

export interface BackendExpense {
  id: number;
  user_id: string;
  original_text: string;
  parsed_data: BackendExpenseResult;
  status: string;
  created_at: string;
}

export interface ParseExpenseResponse {
  message: string;
  document_id: number;
  participants: string[];
  clean_participants: string[];
  is_shared: boolean;
  expense_type: 'shared' | 'personal';
  line_items: BackendLineItem[];
  total_amount: number;
  processing_time: number;
  status: string;
}

export interface GetExpensesResponse {
  status: string;
  count: number;
  expenses: BackendExpense[];
}

export interface InsightsResponse {
  status: string;
  query: string;
  insights: string;
}

export interface DashboardStatsResponse {
  status: string;
  this_month_total: number;
  last_month_total: number;
  category_breakdown: Array<{
    name: string;
    value: number;
  }>;
  personal_count: number;
  shared_count: number;
  total_expenses: number;
}

export interface BudgetResponse {
  status: string;
  monthly_budget: number;
  message?: string;
}

export interface InsightItem {
  id: number;
  user_id: string;
  query: string;
  insight_text: string;
  created_at: string;
  tags: string[];
}

export interface AllInsightsResponse {
  status: string;
  count: number;
  insights: InsightItem[];
}

export interface GenerateInsightResponse {
  status: string;
  query: string;
  insight_text: string;
  insight_id: number;
  created_at: string;
}

// API Configuration
const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = isDevelopment ? '/api' : 'http://127.0.0.1:5002'; // Use proxy in dev, direct URL in production
const DEFAULT_USER_TOKEN = 'user-one'; // Default token for development

class BackendApiService {
  private authToken: string;

  constructor() {
    // Get auth token from localStorage or use default
    this.authToken = localStorage.getItem('auth_token') || DEFAULT_USER_TOKEN;
  }

  private getHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.authToken}`,
    };
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(errorMessage);
    }
    return response.json();
  }

  // Set authentication token
  setAuthToken(token: string): void {
    this.authToken = token;
    localStorage.setItem('auth_token', token);
  }

  // Health check
  async healthCheck(): Promise<{ status: string }> {
    const response = await fetch(`${API_BASE_URL}/health-check`);
    return this.handleResponse(response);
  }

  // Parse expense from natural language text
  async parseExpense(text: string): Promise<ParseExpenseResponse> {
    const response = await fetch(`${API_BASE_URL}/parse-expense`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ text }),
    });
    return this.handleResponse(response);
  }

  // Get all user expenses
  async getExpenses(): Promise<GetExpensesResponse> {
    const response = await fetch(`${API_BASE_URL}/expenses`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Get AI insights about expenses
  async getInsights(query: string): Promise<InsightsResponse> {
    const response = await fetch(`${API_BASE_URL}/insights`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ query }),
    });
    return this.handleResponse(response);
  }

  // Get dashboard statistics
  async getDashboardStats(): Promise<DashboardStatsResponse> {
    const response = await fetch(`${API_BASE_URL}/dashboard/stats`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Get user budget
  async getBudget(): Promise<BudgetResponse> {
    const response = await fetch(`${API_BASE_URL}/budget`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Update user budget
  async updateBudget(monthlyBudget: number): Promise<BudgetResponse> {
    const response = await fetch(`${API_BASE_URL}/budget`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ monthly_budget: monthlyBudget }),
    });
    return this.handleResponse(response);
  }

  // Generate and store insight
  async generateInsight(query: string, tags?: string): Promise<GenerateInsightResponse> {
    const response = await fetch(`${API_BASE_URL}/insights/generate`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ query, tags: tags || '' }),
    });
    return this.handleResponse(response);
  }

  // Get all insights
  async getAllInsights(): Promise<AllInsightsResponse> {
    const response = await fetch(`${API_BASE_URL}/insights`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Delete insight
  async deleteInsight(insightId: number): Promise<{ status: string; message: string }> {
    const response = await fetch(`${API_BASE_URL}/insights/${insightId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Convert backend expense to frontend format
  convertBackendExpenseToFrontend(backendExpense: BackendExpense): import('../types').Expense {
    // Handle case where parsed_data is a JSON string (from database)
    let parsedData = backendExpense.parsed_data;
    if (typeof parsedData === 'string') {
      parsedData = JSON.parse(parsedData);
    }
    
    // Use backend's explicit shared/personal determination
    const cleanParticipants = parsedData.clean_participants || parsedData.participants.filter(p => 
      p && p.toLowerCase() !== 'me' && p.toLowerCase() !== 'myself' && p.toLowerCase() !== 'i'
    );
    const isShared = parsedData.is_shared !== undefined ? parsedData.is_shared : cleanParticipants.length > 0;
    
    // Create vendor name by extracting from original text or using primary item
    const vendorName = this.extractVendorName(backendExpense.original_text, parsedData.line_items);
    
    // Convert line items
    const lineItems = parsedData.line_items.map(item => ({
      description: item.description,
      price: item.amount,
      category: item.category, // Include category from backend
    }));

    const expense: import('../types').Expense = {
      id: `backend-${backendExpense.id}`,
      vendorName,
      transactionDate: backendExpense.created_at.split('T')[0], // Extract date part
      totalAmount: parsedData.total_amount,
      category: this.categorizeExpense(parsedData.line_items),
      lineItems,
      type: isShared ? 'shared' : 'personal',
      // Store original backend data for detailed splits information
      backendData: {
        line_items: parsedData.line_items,
        participants: parsedData.participants,
        clean_participants: cleanParticipants
      }
    } as any;

    if (isShared) {
      // Include 'You' in the members list for display
      expense.members = ['You', ...cleanParticipants];
      expense.sharedDetails = {
        members: ['You', ...cleanParticipants],
        paidBy: 'You', // Assume the user paid
      };
    }

    return expense;
  }

  // Extract vendor name from original text or fallback to line items
  private extractVendorName(originalText: string, lineItems: BackendLineItem[]): string {
    const text = originalText.toLowerCase();
    
    // Common vendor patterns
    const vendorPatterns = [
      /at\s+([A-Za-z\s]+?)(?:\s+with|\s+for|\s+yesterday|\s+today|\.|$)/i,
      /went\s+to\s+([A-Za-z\s]+?)(?:\s+with|\s+for|\s+yesterday|\s+today|\.|$)/i,
      /from\s+([A-Za-z\s]+?)(?:\s+with|\s+for|\s+yesterday|\s+today|\.|$)/i,
      /bought.*?from\s+([A-Za-z\s]+?)(?:\s+with|\s+for|\s+yesterday|\s+today|\.|$)/i,
    ];
    
    for (const pattern of vendorPatterns) {
      const match = originalText.match(pattern);
      if (match && match[1]) {
        const vendor = match[1].trim();
        if (vendor.length > 2 && vendor.length < 50) {
          return this.capitalizeWords(vendor);
        }
      }
    }
    
    // Fallback to primary line item or generic name
    if (lineItems.length > 0) {
      const primaryItem = lineItems.reduce((max, item) => 
        item.amount > max.amount ? item : max, lineItems[0]);
      
      const description = primaryItem.description;
      if (description.length < 30) {
        return this.capitalizeWords(description);
      }
    }
    
    return 'Expense';
  }

  // Helper to capitalize words
  private capitalizeWords(str: string): string {
    return str.replace(/\b\w+/g, word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    );
  }

  // Simple categorization based on line items
  private categorizeExpense(lineItems: BackendLineItem[]): string {
    const descriptions = lineItems.map(item => item.description.toLowerCase()).join(' ');
    
    if (descriptions.includes('food') || descriptions.includes('restaurant') || descriptions.includes('cafe')) {
      return 'Dining';
    }
    if (descriptions.includes('grocery') || descriptions.includes('supermarket')) {
      return 'Groceries';
    }
    if (descriptions.includes('fuel') || descriptions.includes('gas') || descriptions.includes('petrol')) {
      return 'Transport';
    }
    if (descriptions.includes('electronics') || descriptions.includes('phone') || descriptions.includes('laptop')) {
      return 'Electronics';
    }
    if (descriptions.includes('clothes') || descriptions.includes('shopping')) {
      return 'Shopping';
    }
    if (descriptions.includes('utility') || descriptions.includes('electricity') || descriptions.includes('water')) {
      return 'Utilities';
    }
    
    return 'Other';
  }

  // Generate expense text from image (using OCR + backend parsing)
  async parseExpenseFromImage(base64Image: string): Promise<import('../types').Expense> {
    // First, we need to extract text from image using OCR
    // For now, we'll throw an error suggesting to use text input instead
    throw new Error('Image parsing not yet implemented. Please use text input or implement OCR service.');
  }

  // Generate expense text from natural language and parse it
  async parseExpenseFromText(text: string): Promise<import('../types').Expense> {
    const response = await this.parseExpense(text);
    
    // Create a mock backend expense object to convert
    const mockBackendExpense: BackendExpense = {
      id: response.document_id,
      user_id: this.authToken,
      original_text: text,
      parsed_data: {
        participants: response.participants,
        clean_participants: response.clean_participants || response.participants.filter(p => 
          p && p.toLowerCase() !== 'me' && p.toLowerCase() !== 'myself' && p.toLowerCase() !== 'i'
        ),
        is_shared: response.is_shared || (response.clean_participants || response.participants.filter(p => 
          p && p.toLowerCase() !== 'me' && p.toLowerCase() !== 'myself' && p.toLowerCase() !== 'i'
        )).length > 0,
        expense_type: response.expense_type || ((response.clean_participants || response.participants.filter(p => 
          p && p.toLowerCase() !== 'me' && p.toLowerCase() !== 'myself' && p.toLowerCase() !== 'i'
        )).length > 0 ? 'shared' : 'personal'),
        line_items: response.line_items,
        total_amount: response.total_amount,
        processing_time: response.processing_time,
        status: response.status,
      },
      status: response.status,
      created_at: new Date().toISOString(),
    };

    return this.convertBackendExpenseToFrontend(mockBackendExpense);
  }
}

// Export singleton instance
export const backendApi = new BackendApiService();
export default backendApi; 