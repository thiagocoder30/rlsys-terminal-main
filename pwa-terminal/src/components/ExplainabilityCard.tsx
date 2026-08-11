import React from 'react';
import { ExplainabilityDTO } from '../core/dto';
import { Search } from 'lucide-react';

export const ExplainabilityCard = ({ explainability }: { explainability: ExplainabilityDTO }) => {
    return (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-gray-800">
                <h2 className="text-gray-400 text-sm font-semibold flex items-center gap-2">
                    <Search className="w-4 h-4 text-cyan-500" />
                    DECISION EXPLAINABILITY
                </h2>
            </div>
            
            <div className="space-y-3">
                <div>
                    <p className="text-gray-500 text-[10px] uppercase mb-1">Reasoning Vectors</p>
                    <div className="flex flex-wrap gap-2">
                        {explainability.reasons.map((reason, idx) => {
                            const isUp = reason.includes('↑');
                            const isDown = reason.includes('↓');
                            const color = isUp ? 'text-emerald-400 border-emerald-900/50 bg-emerald-900/20' : 
                                          isDown ? 'text-red-400 border-red-900/50 bg-red-900/20' : 
                                          'text-cyan-400 border-cyan-900/50 bg-cyan-900/20';
                            
                            return (
                                <span key={idx} className={`text-xs px-2 py-1 border rounded-md font-mono ${color}`}>
                                    {reason}
                                </span>
                            );
                        })}
                    </div>
                </div>

                <div className="pt-2 border-t border-gray-800/50">
                    <p className="text-gray-500 text-[10px] uppercase mb-1">Summary</p>
                    <p className="text-sm text-gray-300 leading-relaxed">
                        {explainability.summary}
                    </p>
                </div>
            </div>
        </div>
    );
};
