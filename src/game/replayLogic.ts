import { createInitialVillage, TROOP_CATALOG } from './catalog';
import { createBattleState, deployCardAt, finalizeBattle, stepBattle, type VFXPools } from './battleLogic';
import { sound } from './sound';
import type {
  BattleReplay,
  BattleReplayEvent,
  BattleState,
  SpellType,
  TroopType,
  VillageState,
} from './types';

export const MAX_SAVED_REPLAYS = 12;

export interface ReplayPlaybackState {
  replay: BattleReplay;
  battle: BattleState;
  cursor: number;
  speed: 1 | 2 | 4;
  paused: boolean;
  finished: boolean;
  totalDurationSec: number;
  recentEvent: BattleReplayEvent | null;
}

export function buildReplayFromBattle(
  battle: BattleState,
  recordedAtMs = Date.now()
): BattleReplay {
  const result = battle.result ?? finalizeBattle(battle, Boolean(battle.endedEarly));
  const id = `rep_${recordedAtMs}_${battle.replayEvents.length}_${Math.round(battle.elapsedSec * 100)}`;
  return {
    id,
    recordedAtMs,
    targetName: battle.targetName,
    targetTH: battle.targetTH,
    isCampaign: battle.isCampaign,
    campaignStageId: battle.campaignStageId,
    rewardGold: battle.totalLootGold,
    rewardElixir: battle.totalLootElixir,
    exactDurationSec: Number(battle.elapsedSec.toFixed(4)),
    endedEarly: Boolean(battle.endedEarly),
    layout: battle.initialLayout.map((item) => ({ ...item })),
    initialTroops: { ...battle.initialTroops },
    initialReinforcements: { ...battle.initialReinforcements },
    initialSpells: { ...battle.initialSpells },
    initialTroopLevels: battle.troopLevels ? { ...battle.troopLevels } : undefined,
    events: battle.replayEvents.map((ev) => ({ ...ev })),
    result: {
      ...result,
      troopsDeployed: { ...result.troopsDeployed },
      reinforcementsDeployed: result.reinforcementsDeployed
        ? { ...result.reinforcementsDeployed }
        : undefined,
      spellsUsed: { ...result.spellsUsed },
    },
  };
}

export function appendBattleReplay(
  replays: BattleReplay[] | undefined,
  replay: BattleReplay,
  maxCount = MAX_SAVED_REPLAYS
): BattleReplay[] {
  const existing = (replays ?? []).filter((item) => item.id !== replay.id);
  return [replay, ...existing].slice(0, maxCount);
}

export function deleteBattleReplay(
  replays: BattleReplay[] | undefined,
  replayId: string
): BattleReplay[] {
  return (replays ?? []).filter((item) => item.id !== replayId);
}

export function formatReplayEventLabel(event: BattleReplayEvent): string {
  if (event.kind === 'spell') {
    const label = event.type === 'heal' ? '治疗法术' : '狂暴法术';
    return `${label} (${event.gx.toFixed(1)}, ${event.gy.toFixed(1)})`;
  }
  const troopName = TROOP_CATALOG[event.type as TroopType]?.name ?? event.type;
  const prefix = event.kind === 'reinforcement' ? '援军·' : '';
  return `${prefix}${troopName} (${event.gx.toFixed(1)}, ${event.gy.toFixed(1)})`;
}

export function createReplayPlayback(
  replay: BattleReplay,
  speed: 1 | 2 | 4 = 1
): ReplayPlaybackState {
  const baseVillage = createInitialVillage();
  const syntheticVillage: VillageState = {
    ...baseVillage,
    army: { ...replay.initialTroops },
    clanReinforcements: { ...replay.initialReinforcements },
    spells: { ...replay.initialSpells },
    troopLevels: replay.initialTroopLevels
      ? { ...baseVillage.troopLevels, ...replay.initialTroopLevels }
      : baseVillage.troopLevels,
  };

  const battle = createBattleState({
    targetName: replay.targetName,
    targetTH: replay.targetTH,
    isCampaign: replay.isCampaign,
    campaignStageId: replay.campaignStageId,
    rewardGold: replay.rewardGold,
    rewardElixir: replay.rewardElixir,
    layout: replay.layout,
    playerVillage: syntheticVillage,
  });

  // Skip scouting wait during replay playback so timeline aligns with elapsed combat clock
  battle.phase = 'fighting';
  battle.scoutTimeSec = 0;

  const lastEventTime =
    replay.events.length > 0 ? replay.events[replay.events.length - 1].timeSec : 0;
  const totalDurationSec = Math.max(
    replay.exactDurationSec,
    replay.result.durationSec,
    lastEventTime,
    0.5
  );

  const playback: ReplayPlaybackState = {
    replay,
    battle,
    cursor: 0,
    speed,
    paused: false,
    finished: false,
    totalDurationSec,
    recentEvent: null,
  };

  if (replay.endedEarly && replay.events.length === 0 && replay.exactDurationSec <= 0) {
    finalizeBattle(battle, true);
    playback.finished = true;
  }

  return playback;
}

export function stepReplayPlayback(
  playback: ReplayPlaybackState,
  rawDt: number,
  pools?: VFXPools
): { deployedEvents: BattleReplayEvent[] } {
  const deployedEvents: BattleReplayEvent[] = [];
  if (playback.paused || playback.finished) {
    return { deployedEvents };
  }

  const totalDt = Math.max(0, rawDt) * playback.speed;
  const maxSubstep = 0.025;
  const substeps = Math.max(1, Math.ceil(totalDt / maxSubstep));
  const stepDt = totalDt / substeps;

  for (let i = 0; i < substeps; i++) {
    while (playback.cursor < playback.replay.events.length) {
      const ev = playback.replay.events[playback.cursor];
      if (playback.battle.elapsedSec + 1e-6 < ev.timeSec) {
        break;
      }
      if (ev.kind === 'spell') {
        playback.battle.selectedCard = { kind: 'spell', type: ev.type as SpellType };
      } else {
        playback.battle.selectedCard = { kind: ev.kind, type: ev.type as TroopType };
      }
      const res = deployCardAt(playback.battle, ev.gx, ev.gy, pools);
      playback.cursor += 1;
      if (res.deployed) {
        playback.recentEvent = ev;
        deployedEvents.push(ev);
      }
    }

    if (stepDt > 0) {
      stepBattle(playback.battle, stepDt, pools);
    }

    if (
      playback.replay.endedEarly &&
      playback.cursor >= playback.replay.events.length &&
      playback.battle.phase !== 'ended' &&
      playback.battle.elapsedSec >= playback.replay.exactDurationSec - 1e-6
    ) {
      finalizeBattle(playback.battle, true);
    }

    if (playback.battle.phase === 'ended') {
      playback.finished = true;
      break;
    }
  }

  return { deployedEvents };
}

export function seekReplayPlayback(
  replay: BattleReplay,
  targetSec: number,
  speed: 1 | 2 | 4 = 1,
  paused = false,
  pools?: VFXPools
): ReplayPlaybackState {
  const clampedTarget = Math.max(0, targetSec);
  const playback = createReplayPlayback(replay, 1);

  sound.withSuppressedSfx(() => {
    const step = 0.025;
    let safety = 0;
    while (
      !playback.finished &&
      playback.battle.elapsedSec < clampedTarget - 1e-6 &&
      safety < 20000
    ) {
      const remaining = clampedTarget - playback.battle.elapsedSec;
      const dt = Math.min(step, Math.max(0.001, remaining));
      stepReplayPlayback(playback, dt, pools);
      safety += 1;
    }
    if (clampedTarget <= 1e-6 && playback.cursor === 0 && playback.replay.events.length > 0) {
      // Inject t=0 deployments when scrubbing back to start so units appear immediately
      stepReplayPlayback(playback, 0, pools);
    }
  });

  playback.speed = speed;
  playback.paused = paused;
  return playback;
}
