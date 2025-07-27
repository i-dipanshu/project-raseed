import React, { useState, useCallback, useEffect } from 'react';
import type { Expense, View, SharedSpace } from './types';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import UploadReceipt from './components/UploadReceipt';
import Chat from './components/Chat';
import Insights from './components/Insights';
import BillsModal from './components/BillsModal';
import backendApi from './services/backendService';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [sharedSpaces, setSharedSpaces] = useState<SharedSpace[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isBillsModalOpen, setIsBillsModalOpen] = useState(false);
  const [monthlyBudget, setMonthlyBudget] = useState(50000); // Default budget in INR
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Load expenses from backend on component mount
  useEffect(() => {
    loadExpenses();
  }, []);

  const loadExpenses = async () => {
    try {
      setIsInitialLoading(true);
      setError(null);
      
      // Check backend health first
      await backendApi.healthCheck();
      
      // Load user expenses
      const response = await backendApi.getExpenses();
      const backendExpenses = response.expenses.map(exp => 
        backendApi.convertBackendExpenseToFrontend(exp)
      );
      
      setExpenses(backendExpenses);
      
      // Generate shared spaces from shared expenses (API-driven)
      const newSharedSpaces: SharedSpace[] = [];
      backendExpenses.forEach(expense => {
        if (expense.type === 'shared' && expense.members) {
          const existingSpace = newSharedSpaces.find(space => 
            space.members.length === expense.members!.length &&
            space.members.every(member => expense.members!.includes(member))
          );
          
          if (!existingSpace) {
            newSharedSpaces.push({
              id: expense.sharedSpaceId || crypto.randomUUID(),
              name: `${expense.vendorName} Group`,
              members: expense.members
            });
          }
        }
      });
      
      setSharedSpaces(newSharedSpaces);
      
    } catch (error) {
      console.error('Failed to load expenses:', error);
      setError(error instanceof Error ? error.message : 'Failed to load expenses from backend');
    } finally {
      setIsInitialLoading(false);
    }
  };

  const handleNavigate = (view: View) => {
    setCurrentView(view);
    setError(null); // Clear errors on navigation
  };

  const handleReceiptParsed = useCallback(async (parsedData: Omit<Expense, 'id' | 'type'>) => {
    try {
      setIsLoading(true);
      setError(null);

      // The parsedData comes from the backend service, so it's already processed
      const newExpense = parsedData as Expense;

      // AI determines if the expense is shared
      if (newExpense.members && newExpense.members.length > 1) {
        newExpense.type = 'shared';
        
        const newSharedSpace: SharedSpace = {
          id: crypto.randomUUID(),
          name: `${newExpense.vendorName} Bill`,
          members: newExpense.members
        };
        setSharedSpaces(prev => [...prev, newSharedSpace]);

        newExpense.sharedSpaceId = newSharedSpace.id;
        if (!newExpense.sharedDetails) {
          newExpense.sharedDetails = {
            members: newSharedSpace.members,
            paidBy: 'You', // Assume user uploading is the payer
          };
        }
      } else {
        newExpense.type = 'personal';
      }

      setExpenses(prevExpenses => [...prevExpenses, newExpense]);
      setCurrentView('dashboard'); // Switch to dashboard to show the new expense
      
    } catch (error) {
      console.error('Failed to process parsed receipt:', error);
      setError(error instanceof Error ? error.message : 'Failed to process parsed receipt');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSetBudget = (newBudget: number) => {
    setMonthlyBudget(newBudget);
    // In a real app, you might want to save this to backend/localStorage
    localStorage.setItem('monthlyBudget', newBudget.toString());
  };

  // Load budget from localStorage on mount
  useEffect(() => {
    const savedBudget = localStorage.getItem('monthlyBudget');
    if (savedBudget) {
      setMonthlyBudget(parseFloat(savedBudget));
    }
  }, []);

  const renderView = () => {
    if (isInitialLoading) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading your expenses...</p>
          </div>
        </div>
      );
    }

    switch (currentView) {
      case 'dashboard':
        return (
          <Dashboard 
            expenses={expenses} 
            sharedSpaces={sharedSpaces} 
            onOpenBillsModal={() => setIsBillsModalOpen(true)} 
            monthlyBudget={monthlyBudget} 
            onSetBudget={handleSetBudget} 
          />
        );
      case 'upload':
        return (
          <UploadReceipt 
            onReceiptParsed={handleReceiptParsed} 
            setIsLoading={setIsLoading} 
            setError={setError} 
            isLoading={isLoading} 
          />
        );
      case 'chat':
        // Chat is coming soon, redirect to dashboard
        return (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center max-w-md mx-auto p-8">
              <div className="mb-4">
                <svg className="w-16 h-16 mx-auto text-orange-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8z"/>
                  <path d="M11 11h2v6h-2zm0-4h2v2h-2z"/>
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800">Chat with AI - Coming Soon</h3>
              <p className="text-gray-600 mb-4">
                We're working on advanced AI chat features that will let you have natural conversations about your expenses and get personalized financial advice.
              </p>
              <button
                onClick={() => setCurrentView('insights')}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Try Insights Instead
              </button>
            </div>
          </div>
        );
      case 'insights':
        return <Insights />;
      default:
        return (
          <Dashboard 
            expenses={expenses} 
            sharedSpaces={sharedSpaces} 
            onOpenBillsModal={() => setIsBillsModalOpen(true)} 
            monthlyBudget={monthlyBudget} 
            onSetBudget={handleSetBudget} 
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Header currentView={currentView} onNavigate={handleNavigate} />
      <main className="max-w-7xl mx-auto">
        {error && (
          <div className="m-4 p-4 bg-red-50 text-red-800 border border-red-200 rounded-lg text-center" role="alert">
            <p className="font-semibold">An Error Occurred</p>
            <p>{error}</p>
            <button 
              onClick={loadExpenses}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        )}
        {renderView()}
      </main>
      <BillsModal 
        isOpen={isBillsModalOpen}
        onClose={() => setIsBillsModalOpen(false)}
        expenses={expenses}
      />
    </div>
  );
};

export default App;