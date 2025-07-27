import React, { useState } from 'react';
import type { Expense } from '../types';
import { XIcon, ChevronDownIcon } from './icons';

interface BillsModalProps {
  isOpen: boolean;
  onClose: () => void;
  expenses: Expense[];
}

const BillsModal: React.FC<BillsModalProps> = ({ isOpen, onClose, expenses }) => {
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleExpand = (id: string) => {
    setExpandedRowId(expandedRowId === id ? null : id);
  };

  const sortedExpenses = expenses.slice().sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-6 border-b border-slate-200">
          <h2 className="text-2xl font-bold text-gray-800">All Bills</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100">
            <XIcon className="w-6 h-6 text-gray-600" />
          </button>
        </div>
        <div className="flex-grow overflow-y-auto">
          {expenses.length > 0 ? (
            <div className="p-6">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Vendor
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th scope="col" className="relative px-6 py-3">
                      <span className="sr-only">Expand</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {sortedExpenses.map((expense) => (
                    <React.Fragment key={expense.id}>
                      <tr onClick={() => toggleExpand(expense.id)} className="cursor-pointer hover:bg-slate-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {expense.vendorName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {expense.category}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {expense.transactionDate}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full capitalize ${expense.type === 'personal' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                            {expense.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                          ₹{expense.totalAmount.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <ChevronDownIcon className={`w-5 h-5 text-gray-400 transition-transform ${expandedRowId === expense.id ? 'rotate-180' : ''}`}/>
                        </td>
                      </tr>
                      {expandedRowId === expense.id && (
                        <tr className="bg-slate-50">
                          <td colSpan={6} className="px-6 py-4">
                            <div className="space-y-2">
                              <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Items in Bill</h4>
                              {expense.lineItems && expense.lineItems.length > 0 ? (
                                <ul className="divide-y divide-slate-200 bg-white rounded-md border border-slate-200 p-2">
                                  {expense.lineItems.map((item, index) => (
                                    <li key={index} className="flex justify-between py-2 px-2 text-sm">
                                      <div className="flex items-center gap-2 flex-1">
                                        <span className="text-gray-700">{item.description}</span>
                                        {item.category && (
                                          <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                                            {item.category}
                                          </span>
                                        )}
                                      </div>
                                      <span className="font-medium text-gray-800">₹{item.price.toFixed(2)}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-sm text-gray-500 italic">No item details were recorded for this bill.</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-10 text-center text-gray-500">
              <p>You haven't logged any bills yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BillsModal;