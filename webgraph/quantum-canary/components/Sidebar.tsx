'use client';

import { useState, useEffect } from 'react';
import { useSpring, animated } from 'react-spring';
import { CommandResult } from '@/lib/commands';

interface SidebarProps {
  commandResult: CommandResult | null;
}

export default function Sidebar({ commandResult }: SidebarProps) {
  const [results, setResults] = useState<CommandResult[]>([]);

  // Animation for new results
  const fadeIn = useSpring({
    from: { opacity: 0, transform: 'translateX(20px)' },
    to: { opacity: 1, transform: 'translateX(0px)' },
    reset: commandResult !== null,
  });

  useEffect(() => {
    if (commandResult) {
      setResults((prev) => [commandResult, ...prev.slice(0, 9)]); // Keep last 10
    }
  }, [commandResult]);

  return (
    <div className="sidebar">
      <h2 className="border-b-2 border-terminal-green pb-2 mb-4">
        QUANTUM CANARY
      </h2>

      <div className="space-y-4">
        {/* Latest Result */}
        {commandResult && (
          <animated.div style={fadeIn} className="border border-terminal-green p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">
                {commandResult.status === 'success' ? (
                  <span className="status-success">✓</span>
                ) : (
                  <span className="status-error">✗</span>
                )}
              </span>
              <span className="font-bold">
                {commandResult.status === 'success' ? 'SUCCESS' : 'ERROR'}
              </span>
            </div>

            {commandResult.message && commandResult.message !== 'CLEAR' && (
              <div className="text-sm whitespace-pre-wrap">
                {commandResult.message}
              </div>
            )}

            {/* Display data if available */}
            {commandResult.data && Array.isArray(commandResult.data) && commandResult.data.length > 0 && (
              <div className="mt-4 text-xs">
                <div className="font-bold mb-2">Data ({commandResult.data.length} items):</div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {commandResult.data.map((item: any, idx: number) => (
                    <div key={idx} className="border-l-2 border-terminal-green pl-2">
                      {item.chain && (
                        <div className="mb-1">
                          <span className="font-bold text-terminal-green">[{item.chain}]</span>
                        </div>
                      )}
                      {Object.entries(item).map(([key, value]) => {
                        if (key === 'chain') return null; // Skip chain since we display it above
                        return (
                          <div key={key}>
                            <span className="opacity-70">{key}:</span>{' '}
                            <span className="break-all">
                              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </animated.div>
        )}

        {/* Network Status */}
        <div className="border border-terminal-green p-4">
          <h3 className="font-bold mb-2">NETWORK STATUS</h3>
          <div className="text-sm space-y-1">
            <div>
              <span className="opacity-70">Monitoring:</span>{' '}
              <span className="status-success">MULTI-CHAIN</span>
            </div>
            <div>
              <span className="opacity-70">ETH Chain ID:</span> 73571
            </div>
            <div>
              <span className="opacity-70">BASE Chain ID:</span> 8453
            </div>
            <div>
              <span className="opacity-70">Subgraphs:</span>{' '}
              <span className="status-success">CONNECTED</span>
            </div>
          </div>
        </div>

        {/* ASCII Art - Fire Extinguisher (for future alerts) */}
        <div className="border border-terminal-green p-4">
          <h3 className="font-bold mb-2">QUANTUM INTEGRITY</h3>
          <div className="text-center">
            <pre className="text-xs status-success">
{`  ECC STATUS
   ┌─────┐
   │ OK! │
   └──┬──┘
      │
    ┌─┴─┐
    │███│
    │███│
    │███│
    └───┘
`}
            </pre>
            <div className="text-sm status-success">100% SECURE</div>
          </div>
        </div>

        {/* History */}
        {results.length > 1 && (
          <div className="border border-terminal-green p-4">
            <h3 className="font-bold mb-2">RECENT COMMANDS</h3>
            <div className="text-xs space-y-1">
              {results.slice(1, 6).map((result, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className={result.status === 'success' ? 'status-success' : 'status-error'}>
                    {result.status === 'success' ? '✓' : '✗'}
                  </span>
                  <span className="opacity-70 truncate">
                    {result.message?.split('\n')[0].substring(0, 30)}...
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="absolute bottom-4 left-4 right-4 text-xs opacity-50 text-center">
        ETHGlobal BA Demo – No data stored.
      </div>
    </div>
  );
}
