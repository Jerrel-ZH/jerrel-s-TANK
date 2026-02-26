export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export enum EntityType {
  PLAYER = 'PLAYER',
  SOLDIER = 'SOLDIER',
  ENEMY_TANK = 'ENEMY_TANK',
  OBSTACLE_ROCK = 'OBSTACLE_ROCK',
  OBSTACLE_TRENCH = 'OBSTACLE_TRENCH',
}

export enum GameMode {
  CLASSIC = 'CLASSIC',
  TIME = 'TIME',
}

export enum GameStatus {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  GAMEOVER = 'GAMEOVER',
  LEVEL_UP = 'LEVEL_UP',
  VICTORY = 'VICTORY',
}

export interface Entity {
  id: string;
  type: EntityType;
  x: number;
  y: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  speed: number;
  angle: number;
  lastShot?: number;
  lastCollisionTime?: number;
}

export interface Bullet {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  ownerType: EntityType;
  damage: number;
}

export interface Obstacle {
  id: string;
  type: EntityType.OBSTACLE_ROCK | EntityType.OBSTACLE_TRENCH;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BulletImpact {
  id: string;
  x: number;
  y: number;
  startTime: number;
}

export interface GameState {
  status: GameStatus;
  mode: GameMode;
  score: number;
  level: number;
  kills: number;
  player: Entity;
  enemies: Entity[];
  bullets: Bullet[];
  obstacles: Obstacle[];
  scrollOffset: number;
  lastBonusScore: number;
}
