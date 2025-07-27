import React, { useState, useEffect } from 'react';
import backendApi, { InsightItem } from '../services/backendService';
import { GoogleColors } from '../constants/colors';
import { InsightsIcon, PlusCircleIcon, XIcon } from './icons';
import Spinner from './Spinner';
import MarkdownRenderer from './MarkdownRenderer';

const Insights: React.FC = () => {
  const [insights, setInsights] = useState<InsightItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [newQuery, setNewQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Predefined insight queries for quick access
  const suggestedQueries = [
    "What are my top spending categories this month?",
    "How do my shared expenses compare to personal expenses?",
    "What patterns do you see in my spending behavior?",
    "Give me budget optimization suggestions based on my expenses",
    "What are my most expensive recurring expenses?",
    "How can I reduce my grocery spending?"
  ];

  useEffect(() => {
    loadInsights();
  }, []);

  const loadInsights = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await backendApi.getAllInsights();
      setInsights(response.insights);
    } catch (error) {
      console.error('Failed to load insights:', error);
      setError(error instanceof Error ? error.message : 'Failed to load insights');
    } finally {
      setIsLoading(false);
    }
  };

  const generateInsight = async (query: string) => {
    try {
      setIsGenerating(true);
      setError(null);
      const response = await backendApi.generateInsight(query);
      
      // Add the new insight to the list
      const newInsight: InsightItem = {
        id: response.insight_id,
        user_id: '',
        query: response.query,
        insight_text: response.insight_text,
        created_at: response.created_at,
        tags: []
      };
      
      setInsights(prev => [newInsight, ...prev]);
      setNewQuery('');
      setShowGenerateForm(false);
    } catch (error) {
      console.error('Failed to generate insight:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate insight');
    } finally {
      setIsGenerating(false);
    }
  };

  const deleteInsight = async (insightId: number) => {
    try {
      await backendApi.deleteInsight(insightId);
      setInsights(prev => prev.filter(insight => insight.id !== insightId));
    } catch (error) {
      console.error('Failed to delete insight:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete insight');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: GoogleColors.blue }}></div>
          <p style={{ color: GoogleColors.gray[600] }}>Loading your insights...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-3" style={{ color: GoogleColors.gray[800] }}>
            <InsightsIcon className="w-8 h-8" style={{ color: GoogleColors.blue }} />
            Financial Insights
          </h2>
          <p className="mt-2" style={{ color: GoogleColors.gray[600] }}>
            AI-powered analysis of your spending patterns and financial habits
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Connect to Google Wallet Button */}
          <button
            disabled
            className="flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors cursor-not-allowed opacity-50 relative"
            style={{
              backgroundColor: GoogleColors.gray[200],
              color: GoogleColors.gray[500],
              border: `1px solid ${GoogleColors.gray[300]}`
            }}
            title="Coming Soon - Connect your Google Wallet for automatic expense tracking"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21 8V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2h18zM3 10v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8H3zm13 4h-4v-2h4v2z"/>
            </svg>
            <span>Connect to Google Wallet</span>
            <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs px-2 py-1 rounded-full">
              Coming Soon
            </span>
          </button>

          <button
            onClick={() => setShowGenerateForm(true)}
            className="flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors hover:shadow-md"
            style={{
              backgroundColor: GoogleColors.blue,
              color: 'white'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = GoogleColors.blueDark}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = GoogleColors.blue}
            disabled={isGenerating}
          >
            <PlusCircleIcon className="w-5 h-5" />
            Generate New Insight
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg border" style={{ 
          backgroundColor: GoogleColors.red + '10', 
          borderColor: GoogleColors.red + '30',
          color: GoogleColors.red 
        }}>
          <p className="font-medium">Error</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Generate Form Modal */}
      {showGenerateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold" style={{ color: GoogleColors.gray[800] }}>
                  Generate New Insight
                </h3>
                <button
                  onClick={() => setShowGenerateForm(false)}
                  className="p-2 rounded-full hover:bg-opacity-10"
                  style={{ backgroundColor: GoogleColors.gray[100] }}
                >
                  <XIcon className="w-5 h-5" style={{ color: GoogleColors.gray[600] }} />
                </button>
              </div>

              {/* Suggested Queries */}
              <div className="mb-6">
                <h4 className="text-sm font-medium mb-3" style={{ color: GoogleColors.gray[700] }}>
                  Quick Questions:
                </h4>
                <div className="grid grid-cols-1 gap-2">
                  {suggestedQueries.map((query, index) => (
                    <button
                      key={index}
                      onClick={() => generateInsight(query)}
                      className="text-left p-3 rounded-lg border transition-colors hover:shadow-sm"
                      style={{
                        borderColor: GoogleColors.gray[200],
                        backgroundColor: GoogleColors.gray[50]
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = GoogleColors.blue + '10'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = GoogleColors.gray[50]}
                      disabled={isGenerating}
                    >
                      <span className="text-sm" style={{ color: GoogleColors.gray[700] }}>{query}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Query */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2" style={{ color: GoogleColors.gray[700] }}>
                  Or ask your own question:
                </label>
                <textarea
                  value={newQuery}
                  onChange={(e) => setNewQuery(e.target.value)}
                  placeholder="What insights would you like about your spending?"
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:border-transparent resize-none"
                  style={{
                    borderColor: GoogleColors.gray[300],
                    '--tw-ring-color': GoogleColors.blue
                  } as React.CSSProperties}
                  rows={3}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowGenerateForm(false)}
                  className="px-4 py-2 rounded-lg border font-medium transition-colors"
                  style={{
                    borderColor: GoogleColors.gray[300],
                    color: GoogleColors.gray[600]
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => generateInsight(newQuery)}
                  disabled={!newQuery.trim() || isGenerating}
                  className="px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: newQuery.trim() ? GoogleColors.blue : GoogleColors.gray[300],
                    color: 'white'
                  }}
                >
                  {isGenerating ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Generating...
                    </div>
                  ) : (
                    'Generate Insight'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Insights List */}
      <div className="space-y-4">
        {insights.length > 0 ? (
          insights.map((insight) => (
            <div
              key={insight.id}
              className="bg-white rounded-xl shadow-md border hover:shadow-lg transition-shadow"
              style={{ borderColor: GoogleColors.gray[200] }}
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold mb-2" style={{ color: GoogleColors.gray[800] }}>
                      {insight.query}
                    </h4>
                    <p className="text-sm" style={{ color: GoogleColors.gray[500] }}>
                      Generated on {formatDate(insight.created_at)}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteInsight(insight.id)}
                    className="p-2 rounded-full hover:bg-opacity-10 ml-4"
                    style={{ backgroundColor: GoogleColors.red + '10' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = GoogleColors.red + '20'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = GoogleColors.red + '10'}
                  >
                    <XIcon className="w-4 h-4" style={{ color: GoogleColors.red }} />
                  </button>
                </div>
                
                <div 
                  className="p-4 rounded-lg border-l-4"
                  style={{ 
                    backgroundColor: GoogleColors.blue + '08',
                    borderLeftColor: GoogleColors.blue
                  }}
                >
                  <MarkdownRenderer 
                    text={insight.insight_text}
                    style={{ color: GoogleColors.gray[700] }}
                  />
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12 bg-white rounded-xl shadow-md">
            <InsightsIcon className="w-16 h-16 mx-auto mb-4" style={{ color: GoogleColors.gray[300] }} />
            <h3 className="text-xl font-semibold mb-2" style={{ color: GoogleColors.gray[600] }}>
              No insights generated yet
            </h3>
            <p className="mb-6" style={{ color: GoogleColors.gray[500] }}>
              Start by generating your first insight about your spending patterns
            </p>
            <button
              onClick={() => setShowGenerateForm(true)}
              className="px-6 py-3 rounded-lg font-medium transition-colors"
              style={{
                backgroundColor: GoogleColors.blue,
                color: 'white'
              }}
            >
              Generate Your First Insight
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Insights; 