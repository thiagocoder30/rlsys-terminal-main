import React from 'react';
import { ConsensusDTO } from '../core/dto';
import { Network, AlertTriangle } from 'lucide-react';

export const ConsensusCard = ({ consensus }: { consensus: ConsensusDTO }) => {
    return (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-gray-800">
                <h2 className="text-gray-400 text-sm font-semibold flex items-center gap-2">
                    <Network className="w-4 h-4 text-indigo-500" />
                    ENSEMBLE CONSENSUS
                </h2>
                <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded font-medium ${
                        consensus.level === 'ABSOLUTE' ? 'bg-purple-900/50 text-purple-400' :
                        consensus.level === 'STRONG' ? 'bg-indigo-900/50 text-indigo-400' :
                        consensus.level === 'MODERATE' ? 'bg-blue-900/50 text-blue-400' :
                        'bg-gray-800 text-gray-400'
                    }`}>
                        {consensus.level}
                    </span>
                    {consensus.conflictLevel !== 'NONE' && consensus.conflictLevel !== 'LOW' && (
                        <span className="flex items-center gap-1 text-xs px-1.5 py-1 rounded bg-amber-900/30 text-amber-500 font-medium">
                            <AlertTriangle className="w-3 h-3" />
                            {consensus.conflictLevel}
                        </span>
                    )}
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <p className="text-gray-500 text-xs mb-1">Agreement Score</p>
                    <span className="text-sm text-gray-200 font-mono">{consensus.agreementScore.toFixed(1)}%</span>
                </div>
                <div>
                    <p className="text-gray-500 text-xs mb-1">Dominant Strategy</p>
                    <span className="text-sm text-indigo-400 font-mono">
                        {consensus.dominantStrategy || 'NONE'}
                    </span>
                </div>
                <div>
                    <p className="text-gray-500 text-xs mb-1">Confidence</p>
                    <span className="text-sm text-gray-200 font-mono">{consensus.confidenceScore.toFixed(1)}%</span>
                </div>
                <div>
                    <p className="text-gray-500 text-xs mb-1">Conflict Level</p>
                    <span className={`text-sm font-mono ${
                        consensus.conflictLevel === 'CRITICAL' ? 'text-red-500' :
                        consensus.conflictLevel === 'HIGH' ? 'text-amber-500' : 'text-emerald-500'
                    }`}>
                        {consensus.conflictLevel}
                    </span>
                </div>
            </div>

            {consensus.votes.length > 0 && (
                <div className="pt-2 border-t border-gray-800/50">
                    <p className="text-gray-500 text-[10px] uppercase mb-2">Model Votes</p>
                    <div className="space-y-1">
                        {consensus.votes.map((v, i) => (
                            <div key={i} className="flex justify-between text-xs">
                                <span className="text-gray-400">{v.modelId}</span>
                                <div className="flex gap-4">
                                    <span className="text-gray-300 w-24 truncate text-right">{v.suggestedStrategy || 'PASS'}</span>
                                    <span className="text-indigo-400/70 font-mono w-10 text-right">{v.confidence.toFixed(0)}%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
