const fs = require('fs');
const content = fs.readFileSync('pwa-terminal/src/components/OperatorConsole.tsx', 'utf8');

const regex = /\{\/\* Strategy Evolution Governance Architecture \(Sprint-039\) \*\/\}\s*\{sega && sega\.length > 0 && \([\s\S]*?\)\}/;
const replacement = `\{/* Strategy Evolution Governance Architecture (Sprint-039) */\}
                {sega && sega.recommendations && (
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4 font-mono">
                        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                            <h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                                <Crown className="w-4 h-4 text-emerald-400" />
                                STRATEGY EVOLUTION GOVERNANCE (SEGA / SPRINT-039)
                            </h2>
                            <span className="text-[10px] text-gray-400 bg-gray-800 px-2 py-0.5 rounded">
                                INSTITUTIONAL RECOMMENDATIONS
                            </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-center">
                            <div className="bg-black/60 border border-gray-800 rounded p-2">
                                <div className="text-[10px] text-gray-500 uppercase">Inst. Health</div>
                                <div className="text-sm text-emerald-400 font-bold">{(sega.institutionalHealth * 100).toFixed(0)}%</div>
                            </div>
                            <div className="bg-black/60 border border-gray-800 rounded p-2">
                                <div className="text-[10px] text-gray-500 uppercase">Avg Maturity</div>
                                <div className="text-sm text-blue-400 font-bold">{(sega.averageMaturity * 100).toFixed(0)}%</div>
                            </div>
                            <div className="bg-black/60 border border-gray-800 rounded p-2">
                                <div className="text-[10px] text-gray-500 uppercase">Coverage</div>
                                <div className="text-sm text-purple-400 font-bold">{(sega.portfolioCoverage * 100).toFixed(0)}%</div>
                            </div>
                            <div className="bg-black/60 border border-gray-800 rounded p-2">
                                <div className="text-[10px] text-gray-500 uppercase">Promoted</div>
                                <div className="text-sm text-gray-300 font-bold">{sega.promoted}</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {sega.recommendations.map((rec) => (
                                <div key={rec.strategyId} className="bg-black/60 border border-gray-800 rounded-lg p-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-gray-300 font-bold text-sm">{rec.strategyId}</span>
                                        <span className={\`text-[10px] px-2 py-0.5 rounded font-bold \${
                                            rec.recommendation === 'PROMOTE' ? 'bg-emerald-900/50 text-emerald-400' :
                                            rec.recommendation === 'DEPRECATE' ? 'bg-orange-900/50 text-orange-400' :
                                            rec.recommendation === 'RETIRE' ? 'bg-red-900/50 text-red-400' :
                                            rec.recommendation === 'WATCH' ? 'bg-yellow-900/50 text-yellow-400' :
                                            'bg-blue-900/50 text-blue-400'
                                        }\`}>
                                            {rec.recommendation}
                                        </span>
                                    </div>
                                    <div className="space-y-1 text-xs">
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Maturity</span>
                                            <span className="text-gray-300">{(rec.confidence * 100).toFixed(0)}%</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Evidence</span>
                                            <span className="text-gray-300">{(rec.evidenceScore * 100).toFixed(0)}%</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Historical</span>
                                            <span className="text-gray-300">{(rec.historicalSupport * 100).toFixed(0)}%</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Risk</span>
                                            <span className="text-gray-300">{(rec.riskScore * 100).toFixed(0)}%</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}`;

fs.writeFileSync('pwa-terminal/src/components/OperatorConsole.tsx', content.replace(regex, replacement));
