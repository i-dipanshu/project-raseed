import React, { useMemo, useState, useEffect } from 'react';
import type { Expense, SharedSpace } from '../types';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DashboardIcon, UsersIcon, ChevronDownIcon, ReceiptIcon, PencilIcon, CheckIcon } from './icons';
import { GoogleColors, SemanticColors } from '../constants/colors';
import backendApi, { DashboardStatsResponse } from '../services/backendService';

interface DashboardProps {
  expenses: Expense[];
  sharedSpaces: SharedSpace[];
  onOpenBillsModal: () => void;
  monthlyBudget: number;
  onSetBudget: (budget: number) => void;
  onRefreshStats?: () => void;
}

const COLORS = [GoogleColors.blue, GoogleColors.red, GoogleColors.yellow, GoogleColors.green, GoogleColors.greenLight, GoogleColors.yellowDark];

// Helper function to get consistent colors for categories
const getCategoryColor = (category: string) => {
  const colors = [
    { bg: GoogleColors.blue + '20', text: GoogleColors.blue },
    { bg: GoogleColors.green + '20', text: GoogleColors.green },
    { bg: GoogleColors.yellow + '20', text: GoogleColors.yellowDark },
    { bg: GoogleColors.red + '20', text: GoogleColors.red },
    { bg: '#E1F5FE', text: '#0277BD' }, // Light Blue
    { bg: '#FFF3E0', text: '#F57C00' }, // Orange
    { bg: '#F3E5F5', text: '#7B1FA2' }, // Purple
    { bg: '#E8F5E8', text: '#2E7D32' }, // Dark Green
    { bg: '#FFF8E1', text: '#F9A825' }, // Amber
    { bg: GoogleColors.gray[100], text: GoogleColors.gray[600] }, // Default
  ];
  
  // Hash category name to get consistent color
  const hash = category.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

const Dashboard: React.FC<DashboardProps> = ({ expenses, sharedSpaces, onOpenBillsModal, monthlyBudget, onSetBudget, onRefreshStats }) => {
  const [activeTab, setActiveTab] = useState<'personal' | 'shared'>('personal');
  const [expandedExpenseId, setExpandedExpenseId] = useState<string | null>(null);
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(new Set());
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [newBudget, setNewBudget] = useState(monthlyBudget.toString());
  const [dashboardStats, setDashboardStats] = useState<DashboardStatsResponse | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // Load dashboard stats from API
  useEffect(() => {
    loadDashboardStats();
  }, []);

  // Refresh stats when expenses change
  useEffect(() => {
    if (expenses.length > 0) {
      loadDashboardStats();
    }
  }, [expenses.length]);

  const loadDashboardStats = async () => {
    try {
      setIsLoadingStats(true);
      const stats = await backendApi.getDashboardStats();
      setDashboardStats(stats);
    } catch (error) {
      console.error('Failed to load dashboard stats:', error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const handleBudgetSave = async () => {
    const budgetValue = parseFloat(newBudget);
    if (!isNaN(budgetValue) && budgetValue > 0) {
      try {
        await backendApi.updateBudget(budgetValue);
        onSetBudget(budgetValue);
        setIsEditingBudget(false);
      } catch (error) {
        console.error('Failed to update budget:', error);
        onSetBudget(budgetValue);
        setIsEditingBudget(false);
      }
    }
  };

  const { personalExpenses, sharedExpenses } = useMemo(() => {
    return {
      personalExpenses: expenses.filter(e => e.type === 'personal'),
      sharedExpenses: expenses.filter(e => e.type === 'shared'),
    };
  }, [expenses]);

  const sharedAnalytics = useMemo(() => {
    const totalSharedAmount = sharedExpenses.reduce((sum, exp) => sum + exp.totalAmount, 0);
    const averageSharedAmount = sharedExpenses.length > 0 ? totalSharedAmount / sharedExpenses.length : 0;
    
    return {
      totalSharedAmount,
      averageSharedAmount,
      participantCounts: sharedExpenses.reduce((acc, exp) => {
        const memberCount = exp.members?.length || 0;
        acc[memberCount] = (acc[memberCount] || 0) + 1;
        return acc;
      }, {} as Record<number, number>)
    };
 }, [sharedExpenses]);

  const toggleSharedExpenseExpansion = (id: string) => {
    setExpandedExpenseId(expandedExpenseId === id ? null : id);
  };

  const toggleItemExpansion = (itemId: string) => {
    const newExpandedItems = new Set(expandedItemIds);
    if (newExpandedItems.has(itemId)) {
      newExpandedItems.delete(itemId);
    } else {
      newExpandedItems.add(itemId);
    }
    setExpandedItemIds(newExpandedItems);
  };

  // Overview Cards Component
  const renderOverviewCards = () => {
    // Use real API data instead of calculated data
    const thisMonthTotal = dashboardStats?.this_month_total || 0;
    const lastMonthTotal = dashboardStats?.last_month_total || 0;
    const personalCount = dashboardStats?.personal_count || 0;
    const sharedCount = dashboardStats?.shared_count || 0;
    const totalExpenses = dashboardStats?.total_expenses || 0;
    
    const budgetRemaining = monthlyBudget - thisMonthTotal;
    const budgetProgress = monthlyBudget > 0 ? (thisMonthTotal / monthlyBudget) * 100 : 0;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-md">
          <h3 className="text-lg font-medium" style={{ color: GoogleColors.gray[500] }}>This Month Total</h3>
          {isLoadingStats ? (
            <div className="animate-pulse mt-2">
              <div className="h-10 bg-gray-200 rounded w-32"></div>
            </div>
          ) : (
            <>
            <p className="text-4xl font-bold mt-2" style={{ color: GoogleColors.gray[800] }}>₹{thisMonthTotal.toFixed(2)}</p>
              <p className="text-xs mt-1" style={{ color: GoogleColors.gray[400] }}>
                Personal + your share of group expenses
              </p>
            </>
          )}
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-md">
          <h3 className="text-lg font-medium" style={{ color: GoogleColors.gray[500] }}>Last Month</h3>
          {isLoadingStats ? (
            <div className="animate-pulse mt-2">
              <div className="h-10 bg-gray-200 rounded w-32"></div>
            </div>
          ) : (
            <p className="text-4xl font-bold mt-2" style={{ color: GoogleColors.gray[800] }}>₹{lastMonthTotal.toFixed(2)}</p>
          )}
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-md">
          <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium" style={{ color: GoogleColors.gray[500] }}>Budget Status</h3>
            <button 
              onClick={loadDashboardStats} 
              className="p-1 hover:bg-gray-100 rounded"
              title="Refresh stats"
            >
              <svg className="w-4 h-4" style={{ color: GoogleColors.gray[400] }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
          <div className="mt-2">
            {isEditingBudget ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={newBudget}
                  onChange={(e) => setNewBudget(e.target.value)}
                  className="text-2xl font-bold border rounded px-2 py-1 w-32"
                  style={{ borderColor: GoogleColors.gray[300] }}
                />
                <button onClick={handleBudgetSave} className="p-1 hover:bg-gray-100 rounded">
                  <CheckIcon className="w-4 h-4" style={{ color: GoogleColors.green }} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-4xl font-bold" style={{ color: GoogleColors.gray[800] }}>₹{budgetRemaining.toFixed(2)}</p>
                <button onClick={() => setIsEditingBudget(true)} className="p-1 hover:bg-gray-100 rounded">
                  <PencilIcon className="w-4 h-4" style={{ color: GoogleColors.gray[400] }} />
                </button>
              </div>
            )}
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="h-2 rounded-full transition-all duration-300" 
                style={{ 
                  width: `${Math.min(budgetProgress, 100)}%`,
                  backgroundColor: budgetProgress > 100 ? GoogleColors.red : GoogleColors.green
                }}
              ></div>
            </div>
            <p className="text-sm mt-1" style={{ color: GoogleColors.gray[500] }}>
              {budgetProgress.toFixed(1)}% of ₹{monthlyBudget.toFixed(2)} budget
            </p>
            <p className="text-xs mt-1" style={{ color: GoogleColors.gray[400] }}>
              Includes personal + your share of group expenses
            </p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-md">
          <h3 className="text-lg font-medium" style={{ color: GoogleColors.gray[500] }}>Total Bills</h3>
          {isLoadingStats ? (
            <div className="animate-pulse mt-2">
              <div className="h-10 bg-gray-200 rounded w-16"></div>
            </div>
          ) : (
            <p className="text-4xl font-bold mt-2" style={{ color: GoogleColors.gray[800] }}>{totalExpenses}</p>
          )}
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-md">
          <h3 className="text-lg font-medium" style={{ color: GoogleColors.gray[500] }}>Personal Expenses</h3>
          {isLoadingStats ? (
            <div className="animate-pulse mt-2">
              <div className="h-10 bg-gray-200 rounded w-16"></div>
            </div>
          ) : (
            <p className="text-4xl font-bold mt-2" style={{ color: GoogleColors.gray[800] }}>{personalCount}</p>
          )}
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-md">
          <h3 className="text-lg font-medium" style={{ color: GoogleColors.gray[500] }}>Shared Expenses</h3>
          {isLoadingStats ? (
            <div className="animate-pulse mt-2">
              <div className="h-10 bg-gray-200 rounded w-16"></div>
            </div>
          ) : (
            <p className="text-4xl font-bold mt-2" style={{ color: GoogleColors.gray[800] }}>{sharedCount}</p>
          )}
        </div>
      </div>
    );
  };

  const renderPersonalExpenses = () => (
    <div className="bg-white p-6 rounded-xl shadow-md">
      <h3 className="text-xl font-semibold mb-6" style={{ color: GoogleColors.gray[800] }}>All Personal Expenses</h3>
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {personalExpenses.length > 0 ? personalExpenses.slice(0).reverse().map((expense) => {
          const isPersonalExpanded = expandedExpenseId === expense.id;
          return (
            <div 
              key={expense.id} 
              className="border rounded-xl overflow-hidden"
              style={{ borderColor: GoogleColors.gray[200] }}
            >
              <button
                onClick={() => toggleSharedExpenseExpansion(expense.id)}
                className="w-full p-5 text-left hover:bg-opacity-50 transition-colors"
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = GoogleColors.gray[50]}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-lg font-semibold" style={{ color: GoogleColors.gray[800] }}>{expense.vendorName}</h4>
                      <div className="flex items-center gap-4">
                        <p className="text-xl font-bold" style={{ color: GoogleColors.gray[800] }}>₹{expense.totalAmount.toFixed(2)}</p>
                        <ChevronDownIcon 
                          className={`w-6 h-6 transition-transform ${isPersonalExpanded ? 'rotate-180' : ''}`} 
                          style={{ color: GoogleColors.gray[400] }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm" style={{ color: GoogleColors.gray[500] }}>
                        {expense.transactionDate} • {expense.category}
                      </p>
                      <span 
                        className="text-xs font-medium px-3 py-1 rounded-full"
                        style={{ 
                          backgroundColor: GoogleColors.blue + '20', 
                          color: GoogleColors.blue 
                        }}
                      >
                        Personal
                      </span>
                    </div>
                  </div>
                </div>
              </button>
              
              {isPersonalExpanded && expense.lineItems && expense.lineItems.length > 0 && (
                <div className="border-t px-5 pb-5" style={{ borderColor: GoogleColors.gray[200] }}>
                  <h5 className="text-lg font-semibold mb-3 mt-4" style={{ color: GoogleColors.gray[800] }}>
                    📋 Item Details
                  </h5>
                  <div className="space-y-2">
                    {expense.lineItems.map((item, index) => (
                      <div 
                        key={index} 
                        className="flex justify-between items-center p-3 rounded-lg"
                        style={{ backgroundColor: GoogleColors.gray[50] }}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <span className="font-medium" style={{ color: GoogleColors.gray[700] }}>
                            {item.description}
                          </span>
                          {item.category && (
                            <span 
                              className="text-xs font-medium px-2 py-1 rounded-full"
                              style={{ 
                                backgroundColor: getCategoryColor(item.category).bg, 
                                color: getCategoryColor(item.category).text 
                              }}
                            >
                              {item.category}
                            </span>
                          )}
                        </div>
                        <span className="text-lg font-semibold" style={{ color: GoogleColors.gray[800] }}>
                          ₹{item.price.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        }) : (
          <div className="text-center py-12">
            <DashboardIcon className="w-16 h-16 mx-auto mb-4" style={{ color: GoogleColors.gray[300] }} />
            <p className="text-lg font-medium mb-2" style={{ color: GoogleColors.gray[500] }}>No personal expenses recorded yet</p>
            <p className="text-sm" style={{ color: GoogleColors.gray[400] }}>Add your first personal expense to get started!</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderSharedExpenses = () => {
    // Helper function to get expense data from backend with splits
    const getExpenseWithSplits = (expense: Expense) => {
      const backendData = (expense as any).backendData;
      if (backendData?.line_items) {
        return backendData.line_items;
      }
      const lineItems = expense.lineItems.map(item => ({
        description: item.description,
        amount: item.price,
        category: item.category, // Preserve category from lineItems
        splits: []
      }));
      return lineItems;
    };

    // Helper function to calculate participant totals
    const calculateParticipantTotals = (lineItemsWithSplits: any[]) => {
      const participantTotals: Record<string, number> = {};
      
      lineItemsWithSplits.forEach(item => {
        if (item.splits && item.splits.length > 0) {
          item.splits.forEach((split: any) => {
            const participant = split.participant === 'me' ? 'You' : split.participant;
            participantTotals[participant] = (participantTotals[participant] || 0) + split.amount;
          });
        }
      });
      
      return participantTotals;
    };

    return (
      <div className="bg-white p-6 rounded-xl shadow-md">
        <h3 className="text-xl font-semibold mb-6" style={{ color: GoogleColors.gray[800] }}>All Shared Expenses</h3>
        <div className="space-y-6">
          {sharedExpenses.length > 0 ? sharedExpenses.slice(0).reverse().map(expense => {
            const isExpanded = expandedExpenseId === expense.id;
            const members = expense.sharedDetails?.members || [];
            const paidBy = expense.sharedDetails?.paidBy || 'N/A';
            const lineItemsWithSplits = getExpenseWithSplits(expense);
            const participantTotals = calculateParticipantTotals(lineItemsWithSplits);
                  
            return (
              <div key={expense.id} className="border rounded-xl" style={{ borderColor: GoogleColors.gray[200] }}>
                <button 
                  onClick={() => toggleSharedExpenseExpansion(expense.id)} 
                  className="w-full flex items-center justify-between p-6 text-left hover:bg-opacity-50 rounded-xl"
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = GoogleColors.gray[50]}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-lg font-semibold" style={{ color: GoogleColors.gray[800] }}>{expense.vendorName}</p>
                        <p className="text-sm mt-1" style={{ color: GoogleColors.gray[500] }}>
                          {expense.transactionDate} • Paid by {paidBy} • {members.length} participants
                        </p>
                      </div>
                      <div className="text-right flex items-center gap-4">
                        <div>
                          <p className="text-2xl font-bold" style={{ color: GoogleColors.gray[800] }}>₹{expense.totalAmount.toFixed(2)}</p>
                          <span 
                            className="text-xs font-medium px-2 py-1 rounded-full"
                            style={{ 
                              backgroundColor: GoogleColors.green + '20', 
                              color: GoogleColors.green 
                            }}
                          >
                            Shared
                          </span>
                        </div>
                        <ChevronDownIcon 
                          className={`w-6 h-6 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                          style={{ color: GoogleColors.gray[400] }}
                        />
                      </div>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t px-6 pb-6" style={{ borderColor: GoogleColors.gray[200] }}>
                    {/* Participant Allocations */}
                    {Object.keys(participantTotals).length > 0 && (
                      <div className="mt-6 mb-6">
                        <h4 className="text-lg font-semibold mb-4" style={{ color: GoogleColors.gray[800] }}>
                          👥 Participant Allocations
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                          {Object.entries(participantTotals).map(([participant, total]) => {
                            const isCurrentUser = participant === 'You';
                            const percentage = ((total / expense.totalAmount) * 100).toFixed(1);
                            
                            return (
                              <div 
                                key={participant} 
                                className="p-3 rounded-lg border"
                                style={{ 
                                  borderColor: isCurrentUser ? GoogleColors.blue : GoogleColors.gray[200],
                                  backgroundColor: isCurrentUser ? GoogleColors.blue + '15' : GoogleColors.gray[50]
                                }}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-medium text-sm" style={{ 
                                    color: isCurrentUser ? GoogleColors.blue : GoogleColors.gray[700] 
                                  }}>
                                    {participant}
                                    {isCurrentUser && (
                                      <span className="ml-1 text-xs px-1 py-0.5 rounded" style={{
                                        backgroundColor: GoogleColors.blue,
                                        color: 'white'
                                      }}>
                                        YOU
                                      </span>
                                    )}
                                    {paidBy === participant && (
                                      <span className="ml-1 text-xs px-1 py-0.5 rounded" style={{
                                        backgroundColor: GoogleColors.green,
                                        color: 'white'
                                      }}>
                                        PAID
                                      </span>
                                    )}
                                  </span>
                                  <span className="text-xs px-1 py-0.5 rounded" style={{
                                    backgroundColor: GoogleColors.yellow + '30',
                                    color: GoogleColors.gray[700]
                                  }}>
                                    {percentage}%
                                  </span>
                                </div>
                                <p className="text-lg font-bold" style={{ color: GoogleColors.gray[800] }}>
                                  ₹{total.toFixed(2)}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Item Breakdown */}
                    <h4 className="text-lg font-semibold mb-4" style={{ color: GoogleColors.gray[800] }}>
                      📋 Item Breakdown
                    </h4>
                    <div className="space-y-4">
                      {lineItemsWithSplits.map((item, index) => {
                        const itemId = `${expense.id}-item-${index}`;
                        const isItemExpanded = expandedItemIds.has(itemId);
                        
                        return (
                          <div 
                            key={index} 
                            className="border rounded-xl overflow-hidden"
                            style={{ borderColor: GoogleColors.gray[200] }}
                          >
                            {/* Item Header - Clickable */}
                            <button
                              onClick={() => toggleItemExpansion(itemId)}
                              className="w-full p-4 text-left hover:bg-opacity-50 transition-colors"
                              style={{ 
                                backgroundColor: GoogleColors.blue + '08',
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = GoogleColors.blue + '15'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = GoogleColors.blue + '08'}
                            >
                              <div className="flex justify-between items-center">
                                <div className="flex items-center space-x-3 flex-1">
                                  <div 
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: GoogleColors.blue }}
                                  ></div>
                                  <div className="flex items-center gap-3 flex-1">
                                    <h6 className="text-lg font-semibold" style={{ color: GoogleColors.gray[800] }}>
                                      {item.description}
                                    </h6>
                                    {item.category && (
                                      <span 
                                        className="text-xs font-medium px-2 py-1 rounded-full"
                                        style={{ 
                                          backgroundColor: getCategoryColor(item.category).bg, 
                                          color: getCategoryColor(item.category).text 
                                        }}
                                      >
                                        {item.category}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-4">
                                  <div className="text-right">
                                    <span className="text-xl font-bold" style={{ color: GoogleColors.gray[800] }}>
                                      ₹{item.amount.toFixed(2)}
                                    </span>
                                    <p className="text-xs" style={{ color: GoogleColors.gray[500] }}>
                                      Total Cost
                                    </p>
                                  </div>
                                  <ChevronDownIcon 
                                    className={`w-6 h-6 transition-transform ${isItemExpanded ? 'rotate-180' : ''}`} 
                                    style={{ color: GoogleColors.gray[400] }}
                                  />
                                </div>
                              </div>
                            </button>

                            {/* Splits Grid - Collapsible */}
                            {isItemExpanded && item.splits && item.splits.length > 0 && (
                              <div className="border-t p-4" style={{ borderColor: GoogleColors.gray[200] }}>
                                <p className="text-sm font-medium mb-3" style={{ color: GoogleColors.gray[600] }}>
                                  Individual Shares:
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {item.splits.map((split: any, splitIndex: number) => {
                                    const participantName = split.participant === 'me' ? 'You' : split.participant;
                                    const percentage = ((split.amount / item.amount) * 100).toFixed(1);
                                    const isCurrentUser = participantName === 'You';

                                    return (
                                      <div 
                                        key={splitIndex} 
                                        className={`p-3 rounded-lg border-2 transition-all hover:shadow-md ${
                                          isCurrentUser ? 'transform scale-105' : ''
                                        }`}
                                        style={{ 
                                          borderColor: isCurrentUser ? GoogleColors.blue : GoogleColors.gray[200],
                                          backgroundColor: isCurrentUser ? GoogleColors.blue + '15' : GoogleColors.gray[50]
                                        }}
                                      >
                                        <div className="flex items-center justify-between mb-1">
                                          <span className="font-medium text-sm" style={{ 
                                            color: isCurrentUser ? GoogleColors.blue : GoogleColors.gray[700] 
                                          }}>
                                            {participantName}
                                            {isCurrentUser && (
                                              <span className="ml-1 text-xs px-1 py-0.5 rounded" style={{
                                                backgroundColor: GoogleColors.blue,
                                                color: 'white'
                                              }}>
                                                YOU
                                              </span>
                                            )}
                                          </span>
                                          <span className="text-xs px-2 py-1 rounded-full" style={{
                                            backgroundColor: GoogleColors.yellow + '20',
                                            color: GoogleColors.gray[700]
                                          }}>
                                            {percentage}%
                                          </span>
                                        </div>
                                        <p className="text-lg font-bold" style={{ color: GoogleColors.gray[800] }}>
                                          ₹{split.amount.toFixed(2)}
                                        </p>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          }) : (
            <div className="text-center py-12">
              <UsersIcon className="w-16 h-16 mx-auto mb-4" style={{ color: GoogleColors.gray[300] }} />
              <p className="text-lg font-medium mb-2" style={{ color: GoogleColors.gray[500] }}>No shared expenses recorded yet</p>
              <p className="text-sm" style={{ color: GoogleColors.gray[400] }}>Add a bill with multiple people to start sharing expenses!</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-3xl font-bold" style={{ color: GoogleColors.gray[800] }}>Your Financial Dashboard</h2>
      </div>

      {expenses.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl shadow-md">
          <h3 className="text-xl font-semibold" style={{ color: GoogleColors.gray[700] }}>Welcome to Raseed!</h3>
          <p className="mt-2" style={{ color: GoogleColors.gray[500] }}>Upload your first receipt to see your financial dashboard.</p>
        </div>
      ) : (
        <>
          {/* Overview Cards */}
          {renderOverviewCards()}

          {/* Personal/Shared Tab Navigation */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="grid grid-cols-2">
              <button
                onClick={() => setActiveTab('personal')}
                className={`flex items-center justify-center gap-3 p-6 text-lg font-medium transition-all ${
                  activeTab === 'personal' ? 'transform scale-105' : ''
                }`}
                style={{
                  backgroundColor: activeTab === 'personal' ? GoogleColors.blue : GoogleColors.gray[100],
                  color: activeTab === 'personal' ? 'white' : GoogleColors.gray[600]
                }}
              >
                <DashboardIcon className="w-6 h-6" />
                <span>Personal Expenses</span>
              </button>
              
              <button
                onClick={() => setActiveTab('shared')}
                className={`flex items-center justify-center gap-3 p-6 text-lg font-medium transition-all ${
                  activeTab === 'shared' ? 'transform scale-105' : ''
                }`}
                style={{
                  backgroundColor: activeTab === 'shared' ? GoogleColors.blue : GoogleColors.gray[100],
                  color: activeTab === 'shared' ? 'white' : GoogleColors.gray[600]
                }}
              >
                <UsersIcon className="w-6 h-6" />
                <span>Shared Expenses</span>
              </button>
            </div>
          </div>

          {/* Expense Lists */}
          {activeTab === 'personal' ? renderPersonalExpenses() : renderSharedExpenses()}
        </>
      )}
    </div>
  );
};

export default Dashboard;
