'use client';

import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { executeCommand, CommandResult } from '@/lib/commands';

interface TerminalProps {
  onCommandResult: (result: CommandResult) => void;
}

export default function Terminal({ onCommandResult }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [currentLine, setCurrentLine] = useState('');

  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return;

    // Initialize terminal
    const term = new XTerm({
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: 'VT323, monospace',
      fontSize: 20,
      theme: {
        background: '#000000',
        foreground: '#00ff00',
        cursor: '#00ff00',
        cursorAccent: '#000000',
        selectionBackground: '#00ff0044',
      },
      rows: 30,
      cols: 80,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Boot sequence
    const bootMessages = [
      'Initializing Quantum Canary...',
      'Loading quantum-resistant protocols...',
      'ECC Integrity: 100%',
      'Connected to Tenderly ETH Virtual Network',
      'Chain ID: 73571',
      '',
      'Type "help" for available commands.',
      '',
    ];

    let delay = 0;
    bootMessages.forEach((msg) => {
      setTimeout(() => {
        term.writeln(msg);
      }, delay);
      delay += 150;
    });

    setTimeout(() => {
      term.write('quantum-canary> ');
    }, delay);

    // Handle input
    let inputBuffer = '';

    term.onData(async (data) => {
      const code = data.charCodeAt(0);

      // Handle Enter
      if (code === 13) {
        term.writeln('');
        const command = inputBuffer.trim();
        inputBuffer = '';

        if (command) {
          const result = await executeCommand(command);

          // Handle clear command
          if (result.message === 'CLEAR') {
            term.clear();
            term.write('quantum-canary> ');
            return;
          }

          // Display result in terminal
          if (result.message) {
            const lines = result.message.split('\n');
            lines.forEach((line) => term.writeln(line));
          }

          // Send result to sidebar
          onCommandResult(result);
        }

        term.write('quantum-canary> ');
      }
      // Handle Backspace
      else if (code === 127) {
        if (inputBuffer.length > 0) {
          inputBuffer = inputBuffer.slice(0, -1);
          term.write('\b \b');
        }
      }
      // Handle Ctrl+C
      else if (code === 3) {
        term.writeln('^C');
        inputBuffer = '';
        term.write('quantum-canary> ');
      }
      // Handle printable characters
      else if (code >= 32 && code <= 126) {
        inputBuffer += data;
        term.write(data);
      }
    });

    // Handle resize
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
    };
  }, [onCommandResult]);

  return (
    <div className="terminal-wrapper h-full w-full">
      <div ref={terminalRef} className="terminal h-full" />
    </div>
  );
}
