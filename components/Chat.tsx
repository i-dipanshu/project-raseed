
import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage, Expense } from '../types';
import backendApi from '../services/backendService';
import Spinner from './Spinner';
import { LogoIcon, SendIcon } from './icons';
import { GoogleColors } from '../constants/colors';

interface ChatProps {
  expenses: Expense[];
}

const Chat: React.FC<ChatProps> = ({ expenses }) => {
  const [history, setHistory] = useState<ChatMessage[]>([
    { role: 'model', text: 'Hello! I am Raseed, your AI financial assistant powered by your expense data. How can I help you today? You can ask me about your spending patterns, budget advice, or any financial questions!' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [history]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    const newHistory: ChatMessage[] = [...history, { role: 'user', text: userMessage }];
    setHistory(newHistory);
    setInput('');
    setIsLoading(true);

    try {
      // Use backend insights API instead of direct Gemini
      const response = await backendApi.getInsights(userMessage);
      setHistory([...newHistory, { role: 'model', text: response.insights }]);
    } catch (error) {
      console.error('Error getting insights:', error);
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
      setHistory([...newHistory, { 
        role: 'model', 
        text: `Sorry, I'm having trouble analyzing your expenses right now: ${errorMessage}. Please try again or make sure the backend is running.` 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestedQuestions = [
    "What's my spending pattern this month?",
    "Which categories do I spend the most on?",
    "How can I reduce my expenses?",
    "What are my shared expenses?",
    "Give me a financial tip based on my spending"
  ];

  const handleSuggestedQuestion = (question: string) => {
    if (!isLoading) {
      setInput(question);
    }
  };
  
  return (
    <div className="flex flex-col h-[calc(100vh-140px)] max-w-4xl mx-auto">
      <div className="flex-grow overflow-y-auto p-4 md:p-6 space-y-6">
        {history.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                         <div 
               className="max-w-xs lg:max-w-md px-4 py-3 rounded-xl"
               style={{
                 backgroundColor: msg.role === 'user' ? GoogleColors.blue : 'white',
                 color: msg.role === 'user' ? 'white' : GoogleColors.gray[800],
                 border: msg.role === 'user' ? 'none' : `1px solid ${GoogleColors.gray[200]}`
               }}
             >
              {msg.role === 'model' && (
                <div className="flex items-center mb-2">
                  <LogoIcon className="w-5 h-5 text-blue-600 mr-2" />
                  <span className="text-xs font-medium text-gray-500">Raseed AI</span>
                </div>
              )}
              <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-xs lg:max-w-md px-4 py-3 rounded-xl bg-white border border-gray-200">
              <div className="flex items-center mb-2">
                <LogoIcon className="w-5 h-5 text-blue-600 mr-2" />
                <span className="text-xs font-medium text-gray-500">Raseed AI</span>
              </div>
              <div className="flex items-center space-x-2">
                <Spinner />
                <span className="text-sm text-gray-600">Analyzing your expenses...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={chatEndRef} />
      </div>

      {/* Suggested Questions */}
      {history.length === 1 && !isLoading && (
        <div className="px-4 md:px-6 pb-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Try asking:</h3>
            <div className="space-y-2">
              {suggestedQuestions.map((question, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestedQuestion(question)}
                  className="block w-full text-left text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-2 rounded transition-colors"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-gray-200 bg-white p-4 md:p-6">
        <div className="flex space-x-3">
          <div className="flex-1">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me about your spending, budget advice, or financial tips..."
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={2}
              disabled={isLoading}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className={`px-4 py-2 rounded-lg transition-colors ${
              input.trim() && !isLoading
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            <SendIcon className="w-5 h-5" />
          </button>
        </div>
        
        {expenses.length === 0 && (
          <p className="text-xs text-gray-500 mt-2">
            💡 Add some expenses first to get personalized insights about your spending!
          </p>
        )}
      </div>
    </div>
  );
};

export default Chat;
