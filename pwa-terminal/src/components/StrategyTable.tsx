import React from 'react';
import { StrategyDTO } from '../core/dto';
import { Layers } from 'lucide-react';

export const StrategyTable = ({ strategies }: { strategies: StrategyDTO[] }) => {
    return (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-gray-800">
                <h2 className="text-gray-400 text-sm font-semibold flex items-center gap-2">
                    <Layers className="w-4 h-4 text-orange-500" />
                    STRATEGY MATRIX
                </h2>
                <span className="text-xs text-gray-500">
                    Active: {strategies.filter(s => s.status === 'ENABLED').length}
                </span>
            </div>
            
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-gray-800 text-xs text-gray-500">
                            <th className="pb-2 font-medium">Rank</th>
                            <th className="pb-2 font-medium">Strategy</th>
                            <th className="pb-2 font-medium">Status</th>
                            <th className="pb-2 font-medium text-right">Confidence</th>
                            <th className="pb-2 font-medium text-right">Shadow Wt</th>
                            <th className="pb-2 font-medium text-right">Last</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-gray-800/50">
                        {strategies.map((strategy) => (
                            <tr key={strategy.strategyId} className="group hover:bg-gray-800/20 transition-colors">
                                <td className="py-2 text-gray-400">#{strategy.ranking}</td>
                                <td className="py-2 text-gray-200">{strategy.name}</td>
                                <td className="py-2">
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                        strategy.status === 'ENABLED' ? 'bg-emerald-900/50 text-emerald-400' : 
                                        strategy.status === 'DISABLED' ? 'bg-gray-800 text-gray-400' : 'bg-red-900/50 text-red-400'
                                    }`}>
                                        {strategy.status}
                                    </span>
                                </td>
                                <td className="py-2 text-right text-gray-300 font-mono">{strategy.confidence.toFixed(1)}%</td>
                                <td className="py-2 text-right text-gray-400 font-mono">{strategy.shadowWeight.toFixed(2)}</td>
                                <td className={`py-2 text-right text-[10px] font-bold ${
                                    strategy.lastResult === 'WIN' ? 'text-emerald-500' :
                                    strategy.lastResult === 'LOSS' ? 'text-red-500' : 'text-gray-500'
                                }`}>
                                    {strategy.lastResult}
                                </td>
                            </tr>
                        ))}
                        {strategies.length === 0 && (
                            <tr>
                                <td colSpan={6} className="py-4 text-center text-xs text-gray-500">No active strategies</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
