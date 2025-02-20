import { DisarmStep } from '@labrute/core';
import { Application } from 'pixi.js';

import findFighter, { AnimationFighter } from './findFighter';
import updateWeapons from './updateWeapons';

const disarm = (
  app: Application,
  fighters: AnimationFighter[],
  step: DisarmStep,
) => {
  const opponent = findFighter(fighters, step.opponent);
  if (!opponent) {
    throw new Error('Opponent not found');
  }

  // Remove weapon from opponent
  updateWeapons(app, opponent, step.weapon, 'remove');
};

export default disarm;