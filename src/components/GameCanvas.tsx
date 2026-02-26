import React, { useEffect, useRef, useState } from 'react';
import { 
  CANVAS_WIDTH, 
  CANVAS_HEIGHT, 
  PLAYER_SIZE, 
  PLAYER_SPEED, 
  BULLET_SPEED, 
  COLORS, 
  SOLDIER_SIZE, 
  ENEMY_TANK_SIZE,
  SOLDIER_HP,
  ENEMY_TANK_HP,
  SOLDIER_SCORE,
  ENEMY_TANK_SCORE,
  SOLDIER_DAMAGE,
  ENEMY_TANK_DAMAGE,
  KILLS_PER_LEVEL,
  BONUS_HP_THRESHOLD,
  MAX_LEVELS,
  AIM_TIME,
  SCROLL_SPEED_BASE
} from '../constants';
import { EntityType, GameMode, GameStatus, Entity, Bullet, Obstacle } from '../types';

interface GameCanvasProps {
  mode: GameMode;
  onGameOver: (score: number, kills: number) => void;
  onVictory: (score: number) => void;
  onUpdateHUD: (hp: number, score: number, level: number, kills: number) => void;
  isPaused?: boolean;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ mode, onGameOver, onVictory, onUpdateHUD, isPaused }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(null);
  
  // Game State Refs (to avoid closure issues in the loop)
  const stateRef = useRef({
    status: GameStatus.PLAYING,
    score: 0,
    level: 1,
    kills: 0,
    lastBonusScore: 0,
    scrollOffset: 0,
    player: {
      id: 'player',
      type: EntityType.PLAYER,
      x: CANVAS_WIDTH / 2 - PLAYER_SIZE / 2,
      y: CANVAS_HEIGHT - 100,
      width: PLAYER_SIZE,
      height: PLAYER_SIZE,
      hp: 100,
      maxHp: 100,
      speed: PLAYER_SPEED,
      angle: 0,
    } as Entity,
    enemies: [] as (Entity & { lastShot: number; aimingUntil: number | null })[],
    dyingEnemies: [] as (Entity & { deathTime: number })[],
    bulletImpacts: [] as { id: string; x: number; y: number; startTime: number }[],
    bullets: [] as Bullet[],
    obstacles: [] as Obstacle[],
    keys: {} as Record<string, boolean>,
    lastFrameTime: 0,
    spawnTimer: 0,
    obstacleTimer: 0,
  });

  const spawnEnemy = () => {
    const state = stateRef.current;
    if (state.status !== GameStatus.PLAYING || isPaused) return;
    
    const soldierCount = state.enemies.filter(e => e.type === EntityType.SOLDIER).length;
    const tankCount = state.enemies.filter(e => e.type === EntityType.ENEMY_TANK).length;

    if (soldierCount < 2 + Math.min(state.level, 8)) {
      const x = Math.random() * (CANVAS_WIDTH - SOLDIER_SIZE);
      state.enemies.push({
        id: Math.random().toString(),
        type: EntityType.SOLDIER,
        x,
        y: -SOLDIER_SIZE,
        width: SOLDIER_SIZE,
        height: SOLDIER_SIZE,
        hp: SOLDIER_HP,
        maxHp: SOLDIER_HP,
        speed: 1 + state.level * 0.2,
        angle: Math.PI,
        lastShot: 0,
        aimingUntil: null,
      });
    }

    if (tankCount < Math.min(Math.floor(state.level / 3) + 1, 2)) {
      const x = Math.random() * (CANVAS_WIDTH - ENEMY_TANK_SIZE);
      state.enemies.push({
        id: Math.random().toString(),
        type: EntityType.ENEMY_TANK,
        x,
        y: -ENEMY_TANK_SIZE,
        width: ENEMY_TANK_SIZE,
        height: ENEMY_TANK_SIZE,
        hp: ENEMY_TANK_HP,
        maxHp: ENEMY_TANK_HP,
        speed: 0.5 + state.level * 0.1,
        angle: Math.PI,
        lastShot: 0,
        aimingUntil: null,
      });
    }
  };

  const spawnObstacle = () => {
    const state = stateRef.current;
    if (state.status !== GameStatus.PLAYING || isPaused) return;
    const type = Math.random() > 0.5 ? EntityType.OBSTACLE_ROCK : EntityType.OBSTACLE_TRENCH;
    const isRock = type === EntityType.OBSTACLE_ROCK;
    const width = isRock ? 40 + Math.random() * 40 : 60 + Math.random() * 40;
    const height = isRock ? 40 : 25; // Trench is shorter than tank (tank is 40)
    
    // Ensure there's a path (don't block more than 70% of width)
    const x = Math.random() * (CANVAS_WIDTH - width);
    
    state.obstacles.push({
      id: Math.random().toString(),
      type,
      x,
      y: -height,
      width,
      height,
    });
  };

  const checkCollision = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) => {
    return a.x < b.x + b.width &&
           a.x + a.width > b.x &&
           a.y < b.y + b.height &&
           a.y + a.height > b.y;
  };

  const update = (time: number) => {
    const state = stateRef.current;
    if (state.status !== GameStatus.PLAYING || isPaused) {
      state.lastFrameTime = time; // Keep time updated to avoid huge jumps
      return;
    }

    const dt = time - state.lastFrameTime;
    state.lastFrameTime = time;

    const scrollSpeed = SCROLL_SPEED_BASE + (state.level * 0.2);
    state.scrollOffset += scrollSpeed;

    // Player Movement logic with new obstacle rules
    let currentSpeed = state.player.speed;
    const playerRect = { x: state.player.x, y: state.player.y, width: state.player.width, height: state.player.height };
    
    // Check if player is on a trench to reduce speed
    let isOnTrench = false;
    for (const obs of state.obstacles) {
      if (obs.type === EntityType.OBSTACLE_TRENCH && checkCollision(playerRect, obs)) {
        isOnTrench = true;
        break;
      }
    }
    if (isOnTrench) currentSpeed *= 0.4; // Reduce speed significantly on trenches

    let nextX = state.player.x;
    let nextY = state.player.y;

    if (state.keys['ArrowLeft'] || state.keys['a'] || state.keys['A']) nextX -= currentSpeed;
    if (state.keys['ArrowRight'] || state.keys['d'] || state.keys['D']) nextX += currentSpeed;
    if (state.keys['ArrowUp'] || state.keys['w'] || state.keys['W']) nextY -= currentSpeed;
    if (state.keys['ArrowDown'] || state.keys['s'] || state.keys['S']) nextY += currentSpeed;

    // Boundary checks
    nextX = Math.max(0, Math.min(CANVAS_WIDTH - state.player.width, nextX));
    nextY = Math.max(0, Math.min(CANVAS_HEIGHT - state.player.height, nextY));

    // Obstacle collision for player - Only Rocks block movement
    // Check X and Y separately to allow sliding
    const nextPlayerRectX = { x: nextX, y: state.player.y, width: state.player.width, height: state.player.height };
    let canMoveX = true;
    for (const obs of state.obstacles) {
      if (obs.type === EntityType.OBSTACLE_ROCK && checkCollision(nextPlayerRectX, obs)) {
        canMoveX = false;
        break;
      }
    }

    const nextPlayerRectY = { x: state.player.x, y: nextY, width: state.player.width, height: state.player.height };
    let canMoveY = true;
    for (const obs of state.obstacles) {
      if (obs.type === EntityType.OBSTACLE_ROCK && checkCollision(nextPlayerRectY, obs)) {
        canMoveY = false;
        break;
      }
    }

    if (canMoveX) state.player.x = nextX;
    if (canMoveY) state.player.y = nextY;

    // Player-Enemy Collisions (Squashing and Tank Damage)
    const now = Date.now();
    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const enemy = state.enemies[i];
      if (checkCollision(state.player, enemy)) {
        if (enemy.type === EntityType.SOLDIER) {
          // Squash soldier
          state.kills++;
          state.score += SOLDIER_SCORE;
          state.dyingEnemies.push({ ...enemy, deathTime: now });
          state.enemies.splice(i, 1);
          
          // Check level up/bonus
          if (state.score - state.lastBonusScore >= BONUS_HP_THRESHOLD) {
            state.player.hp = Math.min(state.player.maxHp, state.player.hp + 100);
            state.lastBonusScore += BONUS_HP_THRESHOLD;
          }
          if (mode === GameMode.CLASSIC && state.kills >= state.level * KILLS_PER_LEVEL) {
            if (state.level < MAX_LEVELS) state.level++;
            else { state.status = GameStatus.VICTORY; onVictory(state.score); }
          } else if (mode === GameMode.TIME && state.kills % KILLS_PER_LEVEL === 0) {
            state.level++;
          }
        } else if (enemy.type === EntityType.ENEMY_TANK) {
          // Tank collision damage (with a small cooldown to prevent instant death)
          if (!state.player.lastCollisionTime || now - state.player.lastCollisionTime > 500) {
            state.player.hp -= 10;
            enemy.hp -= 1; // 1/3 of 3 HP
            state.player.lastCollisionTime = now;
            
            if (state.player.hp <= 0) {
              state.status = GameStatus.GAMEOVER;
              onGameOver(state.score, state.kills);
            }
            
            if (enemy.hp <= 0) {
              state.kills++;
              state.score += ENEMY_TANK_SCORE;
              state.dyingEnemies.push({ ...enemy, deathTime: now });
              state.enemies.splice(i, 1);
              // Check level up/bonus (same logic as above)
              if (state.score - state.lastBonusScore >= BONUS_HP_THRESHOLD) {
                state.player.hp = Math.min(state.player.maxHp, state.player.hp + 100);
                state.lastBonusScore += BONUS_HP_THRESHOLD;
              }
            }
          }
        }
      }
    }

    // Shooting
    if (state.keys[' ']) {
      const now = Date.now();
      if (!state.player.lastShot || now - state.player.lastShot > 400) {
        state.bullets.push({
          id: Math.random().toString(),
          x: state.player.x + state.player.width / 2 - 2,
          y: state.player.y,
          width: 4,
          height: 10,
          vx: 0,
          vy: -BULLET_SPEED,
          ownerType: EntityType.PLAYER,
          damage: 1,
        });
        state.player.lastShot = now;
      }
    }

    // Spawning
    state.spawnTimer += dt;
    if (state.spawnTimer > 2000 / (1 + state.level * 0.1)) {
      spawnEnemy();
      state.spawnTimer = 0;
    }

    state.obstacleTimer += dt;
    if (state.obstacleTimer > 3000) {
      spawnObstacle();
      state.obstacleTimer = 0;
    }

    // Update Obstacles
    state.obstacles = state.obstacles.filter(obs => {
      obs.y += scrollSpeed;
      return obs.y < CANVAS_HEIGHT;
    });

    // Update Enemies
    state.enemies = state.enemies.filter(enemy => {
      const nextEnemyY = enemy.y + enemy.speed + scrollSpeed * 0.5;
      const nextEnemyRect = { x: enemy.x, y: nextEnemyY, width: enemy.width, height: enemy.height };
      
      let canEnemyMove = true;
      for (const obs of state.obstacles) {
        if (obs.type === EntityType.OBSTACLE_ROCK && checkCollision(nextEnemyRect, obs)) {
          canEnemyMove = false;
          break;
        }
      }

      if (canEnemyMove) {
        enemy.y = nextEnemyY;
      } else {
        // If blocked by rock, move with scroll speed so it doesn't look stuck
        enemy.y += scrollSpeed;
      }
      
      // AI: Aim and shoot
      const distY = state.player.y - enemy.y;
      const distX = state.player.x - enemy.x;
      const dist = Math.sqrt(distX * distX + distY * distY);

      if (dist < 300 && enemy.y < state.player.y) {
        if (!enemy.aimingUntil) {
          enemy.aimingUntil = Date.now() + AIM_TIME;
        } else if (Date.now() > enemy.aimingUntil) {
          // Shoot
          const angle = Math.atan2(distY, distX);
          state.bullets.push({
            id: Math.random().toString(),
            x: enemy.x + enemy.width / 2 - 2,
            y: enemy.y + enemy.height / 2,
            width: 4,
            height: 4,
            vx: Math.cos(angle) * 4,
            vy: Math.sin(angle) * 4,
            ownerType: enemy.type,
            damage: enemy.type === EntityType.SOLDIER ? SOLDIER_DAMAGE : ENEMY_TANK_DAMAGE,
          });
          enemy.aimingUntil = null; // Reset aiming
        }
      } else {
        enemy.aimingUntil = null;
      }

      return enemy.y < CANVAS_HEIGHT;
    });

    // Update Bullets
    state.bullets = state.bullets.filter(bullet => {
      bullet.x += bullet.vx;
      bullet.y += bullet.vy;

      // Collision with player
      if (bullet.ownerType !== EntityType.PLAYER) {
        if (checkCollision(bullet, state.player)) {
          state.player.hp -= bullet.damage;
          state.bulletImpacts.push({ id: Math.random().toString(), x: bullet.x, y: bullet.y, startTime: Date.now() });
          if (state.player.hp <= 0) {
            state.status = GameStatus.GAMEOVER;
            onGameOver(state.score, state.kills);
          }
          return false;
        }
      } else {
        // Collision with enemies
        for (let i = 0; i < state.enemies.length; i++) {
          const enemy = state.enemies[i];
          if (checkCollision(bullet, enemy)) {
            enemy.hp -= 1;
            state.bulletImpacts.push({ id: Math.random().toString(), x: bullet.x, y: bullet.y, startTime: Date.now() });
            if (enemy.hp <= 0) {
              state.kills++;
              const points = enemy.type === EntityType.SOLDIER ? SOLDIER_SCORE : ENEMY_TANK_SCORE;
              state.score += points;
              
              // Add to dying enemies for animation
              state.dyingEnemies.push({
                ...enemy,
                deathTime: Date.now()
              });

              // Bonus HP
              if (state.score - state.lastBonusScore >= BONUS_HP_THRESHOLD) {
                state.player.hp = Math.min(state.player.maxHp, state.player.hp + 100);
                state.lastBonusScore += BONUS_HP_THRESHOLD;
              }

              // Level up logic
              if (mode === GameMode.CLASSIC) {
                if (state.kills >= state.level * KILLS_PER_LEVEL) {
                  if (state.level < MAX_LEVELS) {
                    state.level++;
                  } else {
                    state.status = GameStatus.VICTORY;
                    onVictory(state.score);
                  }
                }
              } else if (mode === GameMode.TIME) {
                if (state.kills % KILLS_PER_LEVEL === 0) {
                  state.level++;
                }
              }

              state.enemies.splice(i, 1);
            }
            return false;
          }
        }
      }

      // Collision with obstacles (Rocks block bullets)
      for (const obs of state.obstacles) {
        if (obs.type === EntityType.OBSTACLE_ROCK && checkCollision(bullet, obs)) {
          state.bulletImpacts.push({ id: Math.random().toString(), x: bullet.x, y: bullet.y, startTime: Date.now() });
          return false;
        }
      }

      return bullet.y > 0 && bullet.y < CANVAS_HEIGHT && bullet.x > 0 && bullet.x < CANVAS_WIDTH;
    });

    // Update Dying Enemies
    state.dyingEnemies = state.dyingEnemies.filter(enemy => {
      enemy.y += scrollSpeed; // Move with scroll
      return now - enemy.deathTime < 1000;
    });

    // Update Bullet Impacts
    state.bulletImpacts = state.bulletImpacts.filter(impact => {
      impact.y += scrollSpeed; // Move with scroll
      return now - impact.startTime < 300; // Last for 300ms
    });

    onUpdateHUD(state.player.hp, state.score, state.level, state.kills);
  };

  const draw = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    const state = stateRef.current;
    const now = Date.now();

    // Clear
    ctx.fillStyle = COLORS.PATH;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Grid/Road lines for scrolling effect
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    const offset = state.scrollOffset % 50;
    for (let y = offset; y < CANVAS_HEIGHT; y += 50) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
      ctx.stroke();
    }

    // Draw Obstacles
    state.obstacles.forEach(obs => {
      if (obs.type === EntityType.OBSTACLE_ROCK) {
        // Rock Visuals
        ctx.save();
        ctx.fillStyle = COLORS.ROCK;
        ctx.beginPath();
        ctx.roundRect(obs.x, obs.y, obs.width, obs.height, 12);
        ctx.fill();
        
        // Rock highlights/shading for 3D feel
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Texture spots
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        for(let i=0; i<3; i++) {
          ctx.beginPath();
          ctx.arc(obs.x + obs.width * (0.2 + i*0.3), obs.y + obs.height * 0.4, 4, 0, Math.PI*2);
          ctx.fill();
        }
        ctx.restore();
      } else {
        // Trench Visuals - More Precise
        ctx.save();
        ctx.fillStyle = '#1c1917'; // Very dark stone/dirt
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
        
        // Trench edges
        ctx.strokeStyle = '#44403c';
        ctx.lineWidth = 1;
        ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
        
        // Depth lines
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        for(let i=1; i<4; i++) {
          const ty = obs.y + (obs.height * i / 4);
          ctx.moveTo(obs.x + 2, ty);
          ctx.lineTo(obs.x + obs.width - 2, ty);
        }
        ctx.stroke();
        
        // Wooden planks across trench
        ctx.fillStyle = '#78350f'; // Brown
        for(let i=0; i<obs.width; i+=20) {
          ctx.fillRect(obs.x + i + 5, obs.y - 2, 4, obs.height + 4);
        }
        ctx.restore();
      }
    });

    // Draw Dying Enemies (Animations)
    state.dyingEnemies.forEach(e => {
      const elapsed = now - e.deathTime;
      const progress = elapsed / 1000;
      
      ctx.save();
      ctx.translate(e.x + e.width / 2, e.y + e.height / 2);
      ctx.globalAlpha = 1 - progress;

      if (e.type === EntityType.SOLDIER) {
        // Falling animation: rotate 90 degrees
        ctx.rotate(progress * Math.PI / 2);
        ctx.fillStyle = '#450a0a'; // Darker red for dead
        // Head
        ctx.beginPath();
        ctx.arc(0, -e.height / 3, e.width / 4, 0, Math.PI * 2);
        ctx.fill();
        // Body
        ctx.fillRect(-2, -e.height / 4, 4, e.height / 2);
        // Arms/Legs simplified
        ctx.fillRect(-e.width / 2, -e.height / 6, e.width, 2);
      } else {
        // Explosion animation: scale up and flicker
        const scale = 1 + progress * 0.5;
        ctx.scale(scale, scale);
        
        // Draw tank body
        ctx.fillStyle = progress % 0.2 > 0.1 ? '#f97316' : '#ef4444'; // Flicker orange/red
        ctx.fillRect(-e.width / 2, -e.height / 2, e.width, e.height);
        
        // Draw explosion sparks
        ctx.fillStyle = '#fbbf24';
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          const dist = progress * 30;
          ctx.fillRect(Math.cos(angle) * dist, Math.sin(angle) * dist, 4, 4);
        }
      }
      ctx.restore();
    });

    // Draw Bullet Impacts
    state.bulletImpacts.forEach(impact => {
      const elapsed = now - impact.startTime;
      const progress = elapsed / 300;
      const radius = 5 + progress * 15;
      
      ctx.save();
      ctx.beginPath();
      ctx.arc(impact.x, impact.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(251, 191, 36, ${1 - progress})`; // Amber 400 with fade
      ctx.fill();
      
      // Inner core
      ctx.beginPath();
      ctx.arc(impact.x, impact.y, radius * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${1 - progress})`;
      ctx.fill();
      ctx.restore();
    });

    // Draw Bullets
    state.bullets.forEach(b => {
      ctx.fillStyle = b.ownerType === EntityType.PLAYER ? COLORS.BULLET_PLAYER : COLORS.BULLET_ENEMY;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
      ctx.fill();
      if (b.ownerType !== EntityType.PLAYER) {
        ctx.shadowBlur = 5;
        ctx.shadowColor = 'white';
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    });

    // Draw Enemies
    state.enemies.forEach(e => {
      ctx.save();
      ctx.translate(e.x + e.width / 2, e.y + e.height / 2);
      
      if (e.type === EntityType.SOLDIER) {
        ctx.fillStyle = COLORS.SOLDIER;
        // Head
        ctx.beginPath();
        ctx.arc(0, -e.height / 3, e.width / 4, 0, Math.PI * 2);
        ctx.fill();
        // Body
        ctx.fillRect(-2, -e.height / 4, 4, e.height / 2);
        // Arms
        ctx.fillRect(-e.width / 2, -e.height / 6, e.width, 2);
        // Legs
        ctx.beginPath();
        ctx.moveTo(-2, e.height / 4);
        ctx.lineTo(-e.width / 3, e.height / 2);
        ctx.moveTo(2, e.height / 4);
        ctx.lineTo(e.width / 3, e.height / 2);
        ctx.strokeStyle = COLORS.SOLDIER;
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        // Armored Vehicle (Enemy Tank) Visuals
        ctx.fillStyle = COLORS.ENEMY_TANK;
        // Main hull
        ctx.beginPath();
        ctx.roundRect(-e.width / 2, -e.height / 2, e.width, e.height, 4);
        ctx.fill();
        
        // Tracks
        ctx.fillStyle = '#450a0a'; // Darker red/brown
        ctx.fillRect(-e.width / 2 - 2, -e.height / 2, 6, e.height);
        ctx.fillRect(e.width / 2 - 4, -e.height / 2, 6, e.height);
        
        // Turret base
        ctx.fillStyle = '#991b1b';
        ctx.beginPath();
        ctx.arc(0, 0, e.width / 3.5, 0, Math.PI * 2);
        ctx.fill();
        
        // Barrel
        ctx.fillStyle = '#7f1d1d';
        ctx.fillRect(-4, 0, 8, e.height / 1.5); // Barrel pointing down (forward for enemy)
        
        // Hatch
        ctx.fillStyle = '#450a0a';
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Aiming indicator
      if (e.aimingUntil) {
        const timeLeft = e.aimingUntil - Date.now();
        const progress = 1 - (timeLeft / AIM_TIME);
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, e.width * 0.8, 0, Math.PI * 2 * progress);
        ctx.stroke();
      }

      ctx.restore();
    });

    // Draw Player
    const p = state.player;
    ctx.save();
    ctx.translate(p.x + p.width / 2, p.y + p.height / 2);
    
    // Tank Body
    ctx.fillStyle = COLORS.PLAYER;
    ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
    
    // Tracks
    ctx.fillStyle = '#166534';
    ctx.fillRect(-p.width / 2 - 4, -p.height / 2, 8, p.height);
    ctx.fillRect(p.width / 2 - 4, -p.height / 2, 8, p.height);
    
    // Turret
    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    ctx.arc(0, 0, p.width / 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Barrel
    ctx.fillStyle = '#15803d';
    ctx.fillRect(-3, -p.height / 2 - 5, 6, p.height / 2);

    ctx.restore();
  };

  const loop = (time: number) => {
    update(time);
    draw();
    requestRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      stateRef.current.keys[e.key] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      stateRef.current.keys[e.key] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    requestRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  // Mobile Touch Controls
  const handleTouch = (key: string, active: boolean) => {
    stateRef.current.keys[key] = active;
  };

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="w-full h-full block"
      />
      
      {/* Mobile Controls Overlay */}
      <div className="absolute bottom-8 left-4 right-4 flex justify-between items-end pointer-events-none md:hidden">
        <div className="grid grid-cols-3 gap-2 pointer-events-auto">
          <div />
          <button 
            className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center active:bg-white/30"
            onTouchStart={() => handleTouch('ArrowUp', true)}
            onTouchEnd={() => handleTouch('ArrowUp', false)}
          >↑</button>
          <div />
          <button 
            className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center active:bg-white/30"
            onTouchStart={() => handleTouch('ArrowLeft', true)}
            onTouchEnd={() => handleTouch('ArrowLeft', false)}
          >←</button>
          <button 
            className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center active:bg-white/30"
            onTouchStart={() => handleTouch('ArrowDown', true)}
            onTouchEnd={() => handleTouch('ArrowDown', false)}
          >↓</button>
          <button 
            className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center active:bg-white/30"
            onTouchStart={() => handleTouch('ArrowRight', true)}
            onTouchEnd={() => handleTouch('ArrowRight', false)}
          >→</button>
        </div>
        
        <button 
          className="w-20 h-20 bg-red-500/40 rounded-full border-4 border-red-500/60 flex items-center justify-center active:bg-red-500/80 pointer-events-auto font-bold text-white"
          onTouchStart={() => handleTouch(' ', true)}
          onTouchEnd={() => handleTouch(' ', false)}
        >FIRE</button>
      </div>
    </div>
  );
};

export default GameCanvas;
