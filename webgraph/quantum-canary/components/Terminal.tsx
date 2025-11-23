'use client';

import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
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

    // Delay fit() to allow renderer to initialize
    setTimeout(() => {
      try {
        fitAddon.fit();
      } catch (e) {
        console.warn('FitAddon: Renderer not ready, retrying...');
        setTimeout(() => fitAddon.fit(), 100);
      }
    }, 0);

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Boot sequence
    const runBootSequence = async () => {
      // Initial loading message
      term.writeln('Initializing Quantum Canary...');
      await new Promise(resolve => setTimeout(resolve, 300));

      try {
        // Fetch ASCII art
        const response = await fetch('/images/ascii-art.txt');
        const asciiArt = await response.text();
        const lines = asciiArt.split('\n');

        // Add blank lines at the start so the bird starts from bottom
        const terminalHeight = term.rows;
        const blankLinesBefore = terminalHeight;

        // Print blank lines to position bird at bottom
        for (let i = 0; i < blankLinesBefore; i++) {
          term.writeln('');
        }

        // Scroll the ASCII art up into view and then off screen
        // Print lines with a delay to create smooth scrolling
        for (const line of lines) {
          term.writeln(line);
          await new Promise(resolve => setTimeout(resolve, 30)); // Fast scroll speed
        }

        // Continue scrolling to push bird off the top
        const blankLinesAfter = terminalHeight + 5;
        for (let i = 0; i < blankLinesAfter; i++) {
          term.writeln('');
          await new Promise(resolve => setTimeout(resolve, 30));
        }

        // Brief pause before status messages
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.error('Failed to load ASCII art:', error);
      }

      // Clear screen effect by printing blank lines
      term.clear();

      // Connection status messages
      const statusMessages = [
        '',
        'Initializing Quantum Canary...',
        'Loading quantum-resistant protocols...',
        'ECC Integrity: 100%',
        'Connected to Multi-Chain Network',
        '  └─ ETH Chain ID: 73571',
        '  └─ BASE Chain ID: 8453',
        '',
        'System Status: ALL SYSTEMS GO',
        '',
        'Type "help" for available commands.',
        '',
      ];

      for (const msg of statusMessages) {
        term.writeln(msg);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Ready for input
      term.write('quantum-canary> ');

      // Auto-focus terminal for immediate input
      term.focus();
    };

    runBootSequence();

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
        try {
          fitAddonRef.current.fit();
        } catch (e) {
          // Ignore if renderer not ready
        }
      }
    };

    // Focus terminal on click
    const handleClick = () => {
      term.focus();
    };

    window.addEventListener('resize', handleResize);
    terminalRef.current?.addEventListener('click', handleClick);

    return () => {
      window.removeEventListener('resize', handleResize);
      terminalRef.current?.removeEventListener('click', handleClick);
      term.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  return (
    <div className="terminal-wrapper h-full w-full cursor-text">
      <div ref={terminalRef} className="terminal h-full" />
    </div>
  );
}
