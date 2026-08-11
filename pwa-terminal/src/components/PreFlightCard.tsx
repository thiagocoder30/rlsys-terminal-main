import React from 'react';
import { RuntimeStatusDTO } from '../core/dto';
import { ActivitySquare, CheckCircle, XCircle } from 'lucide-react';

export const PreFlightCard = ({ status }: { status: RuntimeStatusDTO }) => {
    return (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-gray-800">
                <h2 className="text-gray-400 text-sm font-semibold flex items-center gap-2">
                    <ActivitySquare className="w-4 h-4 text-blue-500" />
                    PRE-FLIGHT TELEMETRY
                </h2>
                <div className="flex items-center gap-2">
                    {status.paperTrading && (
                        <span className="text-xs px-2 py-1 rounded bg-blue-900/50 text-blue-400 font-medium">
                            PAPER ONLY
                        </span>
                    )}
                    {status.status === 'APPROVED' ? (
                        <span className="text-xs px-2 py-1 rounded bg-emerald-900/50 text-emerald-400 font-medium flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> APPROVED
                        </span>
                    ) : (
                        <span className="text-xs px-2 py-1 rounded bg-red-900/50 text-red-400 font-medium flex items-center gap-1">
                            <XCircle className="w-3 h-3" /> REJECTED
                        </span>
                    )}
                </div>
            </div>

            {status.reason && (
                <div className="bg-red-900/20 border border-red-900/50 rounded p-2 text-xs text-red-400">
                    {status.reason}
                </div>
            )}
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                    <p className="text-gray-500 text-xs mb-1">Operational VIX</p>
                    <span className="text-sm text-gray-200 font-mono">{status.operationalVix.toFixed(2)}</span>
                </div>
                <div>
                    <p className="text-gray-500 text-xs mb-1">Shannon Entropy</p>
                    <span className="text-sm text-gray-200 font-mono">{status.shannonEntropy.toFixed(3)}</span>
                </div>
                <div>
                    <p className="text-gray-500 text-xs mb-1">Adaptive Conf.</p>
                    <span className="text-sm text-gray-200 font-mono">{status.adaptiveConfidence.toFixed(1)}%</span>
                </div>
                <div>
                    <p className="text-gray-500 text-xs mb-1">Shadow Perf.</p>
                    <span className="text-sm text-gray-200 font-mono">{status.shadowPerformance.toFixed(1)}%</span>
                </div>
                <div>
                    <p className="text-gray-500 text-xs mb-1">Consensus Rate</p>
                    <span className="text-sm text-gray-200 font-mono">{status.consensusRate.toFixed(1)}%</span>
                </div>
                <div>
                    <p className="text-gray-500 text-xs mb-1">Risk Level</p>
                    <span className={`text-sm font-medium ${status.riskLevel === 'CRITICAL' ? 'text-red-500' : 'text-emerald-500'}`}>
                        {status.riskLevel}
                    </span>
                </div>
            </div>
        </div>
    );
};
