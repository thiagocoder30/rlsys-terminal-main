import React from 'react';
import { BankrollDTO } from '../core/dto';
import { Wallet, TrendingUp, TrendingDown } from 'lucide-react';

export const BankrollCard = ({ bankroll }: { bankroll: BankrollDTO }) => {
    const isProfit = bankroll.profit >= 0;

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-gray-800">
                <h2 className="text-gray-400 text-sm font-semibold flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-purple-500" />
                    BANKROLL EXPOSURE
                </h2>
                <span className="text-sm font-mono text-gray-200">
                    ${bankroll.currentBankroll.toFixed(2)}
                </span>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <p className="text-gray-500 text-xs mb-1">Initial Bankroll</p>
                    <span className="text-sm text-gray-200 font-mono">${bankroll.initialBankroll.toFixed(2)}</span>
                </div>
                <div>
                    <p className="text-gray-500 text-xs mb-1">Net Profit</p>
                    <div className="flex items-center gap-1">
                        {isProfit ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : <TrendingDown className="w-3 h-3 text-red-500" />}
                        <span className={`text-sm font-mono ${isProfit ? 'text-emerald-500' : 'text-red-500'}`}>
                            ${Math.abs(bankroll.profit).toFixed(2)}
                        </span>
                    </div>
                </div>
                <div>
                    <p className="text-gray-500 text-xs mb-1">Drawdown</p>
                    <span className="text-sm text-red-400 font-mono">-{bankroll.drawdown.toFixed(2)}%</span>
                </div>
                <div>
                    <p className="text-gray-500 text-xs mb-1">Suggested Stake</p>
                    <span className="text-sm text-gray-200 font-mono">${bankroll.suggestedStake.toFixed(2)}</span>
                </div>
                <div>
                    <p className="text-gray-500 text-xs mb-1">Stop Loss</p>
                    <span className="text-sm text-red-500 font-mono">${bankroll.stopLoss.toFixed(2)}</span>
                </div>
                <div>
                    <p className="text-gray-500 text-xs mb-1">Take Profit</p>
                    <span className="text-sm text-emerald-500 font-mono">${bankroll.takeProfit.toFixed(2)}</span>
                </div>
            </div>
        </div>
    );
};
