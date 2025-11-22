'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/Sidebar';
import { CommandResult } from '@/lib/commands';

// Load Terminal only on client side (Xterm requires browser APIs)
const Terminal = dynamic(() => import('@/components/Terminal'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-terminal-green font-vt323 text-xl">
      Loading terminal...
    </div>
  ),
});

export default function Home() {
  const [commandResult, setCommandResult] = useState<CommandResult | null>(null);

  const handleCommandResult = (result: CommandResult) => {
    setCommandResult(result);
  };

  return (
    <main className="min-h-screen bg-black p-4 lg:p-8">
      <div className="monitor mx-auto max-w-[1600px] h-[calc(100vh-2rem)] lg:h-[calc(100vh-4rem)]">
        <div className="flex flex-col lg:flex-row h-full">
          {/* Terminal - Left 2/3 */}
          <div className="w-full lg:w-2/3 h-1/2 lg:h-full p-4">
            <Terminal onCommandResult={handleCommandResult} />
          </div>

          {/* Sidebar - Right 1/3 */}
          <div className="w-full lg:w-1/3 h-1/2 lg:h-full relative">
            <Sidebar commandResult={commandResult} />
          </div>
        </div>
      </div>
    </main>
  );
}
