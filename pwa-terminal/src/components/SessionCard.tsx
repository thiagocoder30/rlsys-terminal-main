import React from 'react';
import { SessionDTO } from '../core/dto';
import { Activity, Clock, Shield } from 'lucide-react';

export const SessionCard = ({ session }: { session: SessionDTO }) => {
    return (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-gray-800">
                <h2 className="text-gray-400 text-sm font-semibold flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-500" />
                    SESSION STATUS
                </h2>
                <span className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-300 font-mono">
                    {session.sessionId}
                </span>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <p className="text-gray-500 text-xs mb-1">State</p>
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${session.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        <span className="text-sm text-gray-200 font-medium">{session.status}</span>
                    </div>
                </div>
                <div>
                    <p className="text-gray-500 text-xs mb-1">Heartbeat</p>
                    <div className="flex items-center gap-2">
                        <Activity className={`w-4 h-4 ${session.heartbeatStatus === 'ALIVE' ? 'text-emerald-500' : 'text-red-500'}`} />
                        <span className="text-sm text-gray-200">{session.heartbeatStatus}</span>
                    </div>
                </div>
                <div>
                    <p className="text-gray-500 text-xs mb-1">Uptime</p>
                    <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-200">{(session.executionTimeMs / 1000).toFixed(1)}s</span>
                    </div>
                </div>
                <div>
                    <p className="text-gray-500 text-xs mb-1">Last Decision</p>
                    <span className="text-sm text-gray-200 font-mono text-xs">
                        {session.lastDecisionTimeUtc ? new Date(session.lastDecisionTimeUtc).toLocaleTimeString() : 'N/A'}
                    </span>
                </div>
            </div>
        </div>
    );
};
