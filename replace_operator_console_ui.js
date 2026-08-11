const fs = require('fs');
const path = './pwa-terminal/src/components/OperatorConsole.tsx';
let content = fs.readFileSync(path, 'utf8');

const recommendationUI = `
                    {/* Recommendation Engine */}
                    {data.recommendation && (
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4 md:col-span-2">
                        <div className="flex justify-between items-center pb-2 border-b border-gray-800">
                            <h2 className="text-gray-400 text-sm font-semibold flex items-center gap-2">
                                <Terminal className="w-4 h-4 text-emerald-500" />
                                OPERATIONAL RECOMMENDATION
                            </h2>
                            <span className="text-xs text-gray-500">{new Date(data.recommendation.generatedAt).toLocaleTimeString()}</span>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="col-span-2 md:col-span-4 bg-black/50 rounded-lg p-4 border border-gray-800/50">
                                <p className="text-gray-500 text-xs mb-1 uppercase tracking-wider font-semibold">Institutional Verdict</p>
                                <p className="text-sm text-gray-300 font-mono leading-relaxed">{data.recommendation.explanation}</p>
                            </div>
                            
                            <div className="bg-black/30 rounded-lg p-3 border border-gray-800/30">
                                <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-1">Status</p>
                                <span className={\`text-sm font-bold font-mono \${data.recommendation.isOpportunity ? 'text-emerald-500' : 'text-amber-500'}\`}>
                                    {data.recommendation.isOpportunity ? 'OPPORTUNITY DETECTED' : (data.recommendation.preFlightStatus === 'REJECTED' ? 'LOCKED' : 'HOLD')}
                                </span>
                            </div>
                            
                            <div className="bg-black/30 rounded-lg p-3 border border-gray-800/30">
                                <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-1">Target Strategy</p>
                                <span className={\`text-sm font-bold font-mono \${data.recommendation.strategy ? 'text-indigo-400' : 'text-gray-600'}\`}>
                                    {data.recommendation.strategy || 'N/A'}
                                </span>
                            </div>
                            
                            <div className="bg-black/30 rounded-lg p-3 border border-gray-800/30">
                                <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-1">Recommended Stake</p>
                                <span className={\`text-sm font-bold font-mono \${data.recommendation.stake > 0 ? 'text-emerald-400' : 'text-gray-600'}\`}>
                                    {data.recommendation.stake > 0 ? '$' + data.recommendation.stake.toFixed(2) : '0.00'}
                                </span>
                            </div>
                            
                            <div className="bg-black/30 rounded-lg p-3 border border-gray-800/30">
                                <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-1">Confidence / Consensus</p>
                                <span className="text-sm font-mono text-gray-300">
                                    {(data.recommendation.confidence * 100).toFixed(0)}% / {(data.recommendation.consensus * 100).toFixed(0)}%
                                </span>
                            </div>
                        </div>
                    </div>
                    )}
`;

content = content.replace(
    /{data.status === 'REJECTED' && data.reasons && data.reasons.length > 0 && \(/,
    recommendationUI + "\n                        {data.status === 'REJECTED' && data.reasons && data.reasons.length > 0 && ("
);

fs.writeFileSync(path, content, 'utf8');
