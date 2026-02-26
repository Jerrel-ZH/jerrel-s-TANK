import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Play, Timer, Heart, Target, ChevronRight, RotateCcw, ShieldCheck, Pause, PlayCircle } from 'lucide-react';
import GameCanvas from './components/GameCanvas';
import { GameMode, GameStatus } from './types';

export default function App() {
  const [status, setStatus] = useState<GameStatus>(GameStatus.MENU);
  const [mode, setMode] = useState<GameMode>(GameMode.CLASSIC);
  const [hud, setHud] = useState({ hp: 100, score: 0, level: 1, kills: 0 });
  const [results, setResults] = useState({ score: 0, kills: 0 });

  const startGame = (selectedMode: GameMode) => {
    setMode(selectedMode);
    setHud({ hp: 100, score: 0, level: 1, kills: 0 });
    setStatus(GameStatus.PLAYING);
  };

  const handleGameOver = useCallback((score: number, kills: number) => {
    setResults({ score, kills });
    setStatus(GameStatus.GAMEOVER);
  }, []);

  const handleVictory = useCallback((score: number) => {
    setResults({ score, kills: 1000 });
    setStatus(GameStatus.VICTORY);
  }, []);

  const updateHUD = useCallback((hp: number, score: number, level: number, kills: number) => {
    setHud({ hp, score, level, kills });
  }, []);

  const togglePause = () => {
    if (status === GameStatus.PLAYING) setStatus(GameStatus.PAUSED);
    else if (status === GameStatus.PAUSED) setStatus(GameStatus.PLAYING);
  };

  // Keyboard shortcut for Pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        togglePause();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status]);

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-0 sm:p-4 font-sans">
      <div className="game-container bg-zinc-900 shadow-[0_0_100px_rgba(0,0,0,0.8)] border border-zinc-800 relative">
        
        {/* HUD Overlay */}
        {(status === GameStatus.PLAYING || status === GameStatus.PAUSED) && (
          <div className="absolute top-0 left-0 right-0 p-4 z-10 flex justify-between items-start pointer-events-none">
            <div className="space-y-1">
              <div className="flex items-center gap-2 bg-black/60 backdrop-blur-xl px-3 py-1.5 rounded-full border border-white/10">
                <Heart className={`w-4 h-4 ${hud.hp < 30 ? 'text-red-500 animate-pulse' : 'text-emerald-500'}`} fill="currentColor" />
                <div className="w-24 h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <motion.div 
                    className={`h-full ${hud.hp < 30 ? 'bg-red-500' : 'bg-emerald-500'}`}
                    initial={{ width: '100%' }}
                    animate={{ width: `${Math.max(0, hud.hp)}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono font-bold">{Math.max(0, Math.floor(hud.hp))}</span>
              </div>
              <div className="flex items-center gap-2 bg-black/60 backdrop-blur-xl px-3 py-1.5 rounded-full border border-white/10">
                <Target className="w-4 h-4 text-amber-500" />
                <span className="text-[10px] font-mono font-bold">{hud.kills} KILLS</span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1">
              <div className="bg-black/60 backdrop-blur-xl px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest">Score</span>
                <span className="text-sm font-mono font-bold text-white">{hud.score.toLocaleString()}</span>
              </div>
              <div className="flex gap-1">
                <div className="bg-black/60 backdrop-blur-xl px-3 py-1.5 rounded-full border border-white/10">
                  <span className="text-[10px] font-mono font-bold text-amber-400">LVL {hud.level}</span>
                </div>
                <button 
                  onClick={togglePause}
                  className="pointer-events-auto bg-black/60 backdrop-blur-xl p-1.5 rounded-full border border-white/10 hover:bg-white/10 transition-colors"
                >
                  {status === GameStatus.PAUSED ? <PlayCircle className="w-4 h-4 text-white" /> : <Pause className="w-4 h-4 text-white" />}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Game View */}
        {(status === GameStatus.PLAYING || status === GameStatus.PAUSED) && (
          <GameCanvas 
            mode={mode} 
            onGameOver={handleGameOver} 
            onVictory={handleVictory}
            onUpdateHUD={updateHUD}
            isPaused={status === GameStatus.PAUSED}
          />
        )}

        {/* Menu Overlay */}
        <AnimatePresence>
          {status === GameStatus.MENU && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 bg-zinc-950/95 flex flex-col items-center justify-center p-8 text-center"
            >
              <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="mb-12"
              >
                <div className="inline-block p-4 bg-emerald-500/10 rounded-3xl border border-emerald-500/20 mb-6 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                  <ShieldCheck className="w-16 h-16 text-emerald-500" />
                </div>
                <h1 className="text-5xl font-black tracking-tighter text-white uppercase italic leading-none">
                  丁的<span className="text-emerald-500">坦克闯关</span>
                </h1>
                <p className="text-zinc-500 text-xs font-mono mt-3 tracking-[0.3em] uppercase">竖版卷轴战争</p>
              </motion.div>

              <div className="w-full space-y-4 max-w-xs">
                <button 
                  onClick={() => startGame(GameMode.CLASSIC)}
                  className="w-full group relative flex items-center justify-between bg-zinc-100 text-zinc-950 px-6 py-5 rounded-2xl font-black transition-all hover:scale-105 active:scale-95 shadow-xl"
                >
                  <div className="flex items-center gap-3">
                    <Play className="w-6 h-6 fill-current" />
                    <span className="uppercase tracking-tight text-lg">经典模式</span>
                  </div>
                  <ChevronRight className="w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>

                <button 
                  onClick={() => startGame(GameMode.TIME)}
                  className="w-full group relative flex items-center justify-between bg-zinc-800/50 text-white px-6 py-5 rounded-2xl font-black border border-zinc-700 transition-all hover:bg-zinc-700 hover:scale-105 active:scale-95 backdrop-blur-md"
                >
                  <div className="flex items-center gap-3">
                    <Timer className="w-6 h-6" />
                    <span className="uppercase tracking-tight text-lg">高分挑战</span>
                  </div>
                  <ChevronRight className="w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </div>

              <div className="mt-16 text-zinc-600 text-[10px] font-mono uppercase tracking-[0.3em] space-y-2">
                <p>WASD / Arrows to Move • Space to Fire</p>
                <p>P to Pause • Mobile: Touch Controls</p>
              </div>
            </motion.div>
          )}

          {status === GameStatus.PAUSED && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 z-20 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center"
            >
              <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter mb-8">Paused</h2>
              <button 
                onClick={togglePause}
                className="bg-white text-black px-10 py-4 rounded-2xl font-bold hover:scale-105 active:scale-95 transition-transform flex items-center gap-3"
              >
                <PlayCircle className="w-6 h-6" />
                RESUME
              </button>
            </motion.div>
          )}

          {status === GameStatus.GAMEOVER && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 z-30 bg-red-950/95 flex flex-col items-center justify-center p-8 text-center"
            >
              <div className="mb-6 p-4 bg-red-500/20 rounded-full border border-red-500/30">
                <RotateCcw className="w-12 h-12 text-red-500" />
              </div>
              <h2 className="text-6xl font-black text-white uppercase italic tracking-tighter mb-2">Wasted</h2>
              <p className="text-red-300 font-mono text-sm uppercase tracking-widest mb-10">Mission Failed</p>
              
              <div className="grid grid-cols-2 gap-4 w-full max-w-xs mb-10">
                <div className="bg-black/40 p-5 rounded-2xl border border-white/5">
                  <p className="text-zinc-500 text-[10px] uppercase font-bold mb-1 tracking-widest">Score</p>
                  <p className="text-3xl font-mono font-bold text-white">{results.score.toLocaleString()}</p>
                </div>
                <div className="bg-black/40 p-5 rounded-2xl border border-white/5">
                  <p className="text-zinc-500 text-[10px] uppercase font-bold mb-1 tracking-widest">Kills</p>
                  <p className="text-3xl font-mono font-bold text-white">{results.kills}</p>
                </div>
              </div>

              <button 
                onClick={() => setStatus(GameStatus.MENU)}
                className="flex items-center gap-3 bg-white text-black px-10 py-5 rounded-2xl font-black hover:scale-105 active:scale-95 transition-transform uppercase tracking-tight"
              >
                <RotateCcw className="w-6 h-6" />
                Retry Mission
              </button>
            </motion.div>
          )}

          {status === GameStatus.VICTORY && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 z-30 bg-emerald-950/95 flex flex-col items-center justify-center p-8 text-center overflow-hidden"
            >
              <motion.div
                animate={{ 
                  scale: [1, 1.1, 1],
                  rotate: [0, 5, -5, 0]
                }}
                transition={{ repeat: Infinity, duration: 3 }}
                className="mb-8"
              >
                <Trophy className="w-32 h-32 text-yellow-400 mx-auto drop-shadow-[0_0_30px_rgba(250,204,21,0.6)]" />
              </motion.div>
              
              <h2 className="text-6xl font-black text-white uppercase italic tracking-tighter mb-2">Victory</h2>
              <p className="text-emerald-300 font-mono text-sm uppercase tracking-widest mb-10">All Sectors Secured</p>
              
              <div className="bg-black/40 p-8 rounded-3xl border border-white/10 w-full max-w-xs mb-10">
                <p className="text-zinc-500 text-[10px] uppercase font-bold mb-1 tracking-widest">Final Score</p>
                <p className="text-5xl font-mono font-bold text-white">{results.score.toLocaleString()}</p>
              </div>

              <button 
                onClick={() => setStatus(GameStatus.MENU)}
                className="bg-zinc-100 text-zinc-950 px-12 py-5 rounded-2xl font-black hover:scale-105 active:scale-95 transition-transform uppercase tracking-tight"
              >
                Return to Base
              </button>

              {/* Victory Particles Simulation */}
              <div className="absolute inset-0 pointer-events-none">
                {[...Array(30)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ y: 700, x: Math.random() * 400, opacity: 1, scale: Math.random() * 2 }}
                    animate={{ y: -100, opacity: 0, rotate: 360 }}
                    transition={{ duration: 2 + Math.random() * 3, repeat: Infinity, delay: Math.random() * 2 }}
                    className="absolute w-1.5 h-1.5 bg-yellow-400 rounded-sm"
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
