'use client';

import { useState, useEffect } from 'react';
import { useSpring, animated } from 'react-spring';
import { CommandResult } from '@/lib/commands';
import { tenderlyClient, baseClient } from '@/lib/apollo';
import { gql } from '@apollo/client';

interface SidebarProps {
  commandResult: CommandResult | null;
}

interface ChainStatus {
  connected: boolean;
  blockNumber: number | null;
  error?: string;
}

const HEALTH_CHECK_QUERY = gql`
  query HealthCheck {
    _meta {
      block {
        number
      }
    }
  }
`;

export default function Sidebar({ commandResult }: SidebarProps) {
  const [results, setResults] = useState<CommandResult[]>([]);
  const [ethStatus, setEthStatus] = useState<ChainStatus>({ connected: false, blockNumber: null });
  const [baseStatus, setBaseStatus] = useState<ChainStatus>({ connected: false, blockNumber: null });

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

  // Health check for both chains
  useEffect(() => {
    const checkChainHealth = async () => {
      // Check ETH chain
      try {
        const ethResult = await tenderlyClient.query({ query: HEALTH_CHECK_QUERY });
        setEthStatus({
          connected: true,
          blockNumber: ethResult.data?._meta?.block?.number || null,
        });
      } catch (error: any) {
        setEthStatus({
          connected: false,
          blockNumber: null,
          error: error.message,
        });
      }

      // Check BASE chain
      try {
        const baseResult = await baseClient.query({ query: HEALTH_CHECK_QUERY });
        setBaseStatus({
          connected: true,
          blockNumber: baseResult.data?._meta?.block?.number || null,
        });
      } catch (error: any) {
        setBaseStatus({
          connected: false,
          blockNumber: null,
          error: error.message,
        });
      }
    };

    // Check immediately on mount
    checkChainHealth();

    // Check every 30 seconds
    const interval = setInterval(checkChainHealth, 30000);

    return () => clearInterval(interval);
  }, []);

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
          <div className="text-sm space-y-2">
            <div>
              <span className="opacity-70">Monitoring:</span>{' '}
              <span className="status-success">MULTI-CHAIN</span>
            </div>

            {/* ETH Status */}
            <div className="border-l-2 border-terminal-green pl-2">
              <div className="flex items-center justify-between">
                <span className="font-bold">ETH (73571)</span>
                {ethStatus.connected ? (
                  <span className="status-success">✓ ONLINE</span>
                ) : (
                  <span className="status-error">✗ OFFLINE</span>
                )}
              </div>
              {ethStatus.blockNumber && (
                <div className="text-xs opacity-70">Block: {ethStatus.blockNumber.toLocaleString()}</div>
              )}
              {ethStatus.error && (
                <div className="text-xs status-error">{ethStatus.error}</div>
              )}
            </div>

            {/* BASE Status */}
            <div className="border-l-2 border-terminal-green pl-2">
              <div className="flex items-center justify-between">
                <span className="font-bold">BASE (8453)</span>
                {baseStatus.connected ? (
                  <span className="status-success">✓ ONLINE</span>
                ) : (
                  <span className="status-error">✗ OFFLINE</span>
                )}
              </div>
              {baseStatus.blockNumber && (
                <div className="text-xs opacity-70">Block: {baseStatus.blockNumber.toLocaleString()}</div>
              )}
              {baseStatus.error && (
                <div className="text-xs status-error">{baseStatus.error}</div>
              )}
            </div>

            {/* Overall Status */}
            <div className="pt-1 border-t border-terminal-green border-opacity-30">
              <span className="opacity-70">Overall:</span>{' '}
              {ethStatus.connected && baseStatus.connected ? (
                <span className="status-success">ALL SYSTEMS GO</span>
              ) : ethStatus.connected || baseStatus.connected ? (
                <span className="text-yellow-400">PARTIAL</span>
              ) : (
                <span className="status-error">DISCONNECTED</span>
              )}
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
