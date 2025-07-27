import React, { useState, useCallback, useRef } from 'react';
import backendApi from '../services/backendService';
import type { Expense } from '../types';
import Spinner from './Spinner';
import { UploadIcon, DocumentTextIcon } from './icons';
import { GoogleColors, SemanticColors } from '../constants/colors';

interface UploadReceiptProps {
  onReceiptParsed: (expenseData: Omit<Expense, 'id' | 'type'>) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  isLoading: boolean;
}

const UploadReceipt: React.FC<UploadReceiptProps> = ({ onReceiptParsed, setIsLoading, setError, isLoading }) => {
  const [inputType, setInputType] = useState<'image' | 'text'>('text');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [billText, setBillText] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasInput = imagePreview || billText.trim() !== '';

  const handleFileChange = (file: File | null) => {
    if (file && file.type.startsWith('image/')) {
      setError(null);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setError("Please select a valid image file.");
      setImagePreview(null);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleFileChange(event.target.files ? event.target.files[0] : null);
  };
  
  const onDragOver = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
  }
  
  const onDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    handleFileChange(event.dataTransfer.files ? event.dataTransfer.files[0] : null);
  }

  const resetForm = () => {
    setBillText('');
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setError(null);
  };

  const handleSubmit = useCallback(async () => {
    if (!hasInput || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      let parsedData: Expense;

      if (inputType === 'text' && billText.trim()) {
        // Use backend API for text parsing
        parsedData = await backendApi.parseExpenseFromText(billText.trim());
      } else if (inputType === 'image' && imagePreview) {
        // For now, we'll show an error as image parsing needs OCR implementation
        setError("Image parsing is not yet implemented. Please use text input or describe your expense in words.");
        setIsLoading(false);
        return;
      } else {
        setError("Please provide expense details to parse.");
        setIsLoading(false);
        return;
      }

      onReceiptParsed(parsedData);
      resetForm();
      
    } catch (error) {
      console.error("Error parsing expense:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to parse expense. Please try again.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [inputType, billText, imagePreview, hasInput, isLoading, onReceiptParsed, setIsLoading, setError]);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Add New Expense</h2>
        
        {/* Input Type Selector */}
                 <div className="flex mb-6" style={{ borderBottom: `1px solid ${GoogleColors.gray[200]}` }}>
           <button
             onClick={() => setInputType('text')}
             className={`px-4 py-2 font-medium ${
               inputType === 'text'
                 ? 'border-b-2'
                 : 'hover:opacity-70'
             }`}
             style={{
               color: inputType === 'text' ? GoogleColors.blue : GoogleColors.gray[500],
               borderBottomColor: inputType === 'text' ? GoogleColors.blue : 'transparent'
             }}
           >
             <DocumentTextIcon className="w-5 h-5 inline-block mr-2" />
             Describe Expense
           </button>
           <button
            disabled
             onClick={() => setInputType('image')}
             className={`px-4 py-2 font-medium ml-6 cursor-not-allowed opacity-50 relative ${
               inputType === 'image'
                 ? 'border-b-2'
                 : 'hover:opacity-50'
             }`}
             style={{
               color: inputType === 'image' ? GoogleColors.blue : GoogleColors.gray[500],
               borderBottomColor: inputType === 'image' ? GoogleColors.blue : 'transparent'
             }}
           >
             <UploadIcon className="w-5 h-5 inline-block mr-2" />
             Upload Receipt
             <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs px-2 py-1 rounded-full">
               Coming Soon
             </span>
           </button>
         </div>

        {/* Text Input */}
        {inputType === 'text' && (
          <div className="mb-6">
            <label htmlFor="billText" className="block text-sm font-medium text-gray-700 mb-2">
              Describe your expense in natural language
            </label>
            <textarea
              id="billText"
              value={billText}
              onChange={(e) => setBillText(e.target.value)}
              placeholder="Example: 'I spent 2500 rupees at Big Bazaar yesterday buying groceries including rice, dal, vegetables, and snacks. The bill was shared between me, Priya, and Rohit.'"
              className="w-full h-32 p-3 border rounded-lg focus:ring-2 focus:border-transparent resize-none"
              style={{
                borderColor: GoogleColors.gray[300],
                '--tw-ring-color': GoogleColors.blue
              } as React.CSSProperties}
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500 mt-2">
              💡 Be specific about amounts, vendor names, dates, and if the expense was shared with others.
            </p>
          </div>
        )}

        {/* Image Upload */}
        {inputType === 'image' && (
          <div className="mb-6">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center bg-gray-50">
              <div className="mb-4 text-orange-600 bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p className="text-sm font-medium">⚠️ Image parsing coming soon!</p>
                <p className="text-xs mt-1">For now, please use the text input to describe your expense.</p>
              </div>
              
              {!imagePreview ? (
                <label
                  htmlFor="fileInput"
                  className="cursor-pointer"
                  onDragOver={onDragOver}
                  onDrop={onDrop}
                >
                  <UploadIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-2">Drop an image here or click to browse</p>
                  <p className="text-sm text-gray-400">Supports JPG, PNG files</p>
                </label>
              ) : (
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt="Receipt preview"
                    className="max-w-full max-h-64 mx-auto rounded-lg shadow-md"
                  />
                  <button
                    onClick={resetForm}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-600 transition-colors"
                    disabled={isLoading}
                  >
                    ✕
                  </button>
                </div>
              )}
              
              <input
                ref={fileInputRef}
                id="fileInput"
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                disabled={isLoading}
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between items-center">
                     <button
             onClick={resetForm}
             className="px-4 py-2 transition-colors"
             style={{
               color: GoogleColors.gray[600]
             }}
             onMouseEnter={(e) => e.currentTarget.style.color = GoogleColors.gray[800]}
             onMouseLeave={(e) => e.currentTarget.style.color = GoogleColors.gray[600]}
             disabled={isLoading}
           >
             Clear
           </button>
           
           <button
             onClick={handleSubmit}
             disabled={!hasInput || isLoading}
             className="px-6 py-2 rounded-lg font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
             style={{
               backgroundColor: hasInput && !isLoading ? GoogleColors.blue : GoogleColors.gray[300],
               color: hasInput && !isLoading ? 'white' : GoogleColors.gray[500]
             }}
             onMouseEnter={(e) => {
               if (hasInput && !isLoading) {
                 e.currentTarget.style.backgroundColor = GoogleColors.blueDark;
               }
             }}
             onMouseLeave={(e) => {
               if (hasInput && !isLoading) {
                 e.currentTarget.style.backgroundColor = GoogleColors.blue;
               }
             }}
           >
            {isLoading ? (
              <div className="flex items-center">
                <Spinner />
                <span className="ml-2">Processing...</span>
              </div>
            ) : (
              'Parse Expense'
            )}
          </button>
        </div>

        {/* Tips for better parsing */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-sm font-medium text-blue-800 mb-2">💡 Tips for better expense parsing:</h3>
          <ul className="text-xs text-blue-700 space-y-1">
            <li>• Include specific amounts in rupees</li>
            <li>• Mention the vendor/store name</li>
            <li>• Add the date if not today</li>
            <li>• List individual items if applicable</li>
            <li>• Mention if expense was shared with others</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default UploadReceipt;