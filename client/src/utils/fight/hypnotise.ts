import { HypnotiseStep } from '@labrute/core';
import { Easing, Tweener } from 'pixi-tweener';
import { Application } from 'pixi.js';
import changeAnimation from './changeAnimation';
import { getRandomPosition } from './fightPositions';
import findFighter, { AnimationFighter } from './findFighter';

const hypnotise = async (
  app: Application,
  fighters: AnimationFighter[],
  step: HypnotiseStep,
  speed: React.MutableRefObject<number>,
) => {
  const brute = findFighter(fighters, step.brute);
  if (!brute) {
    throw new Error('Brute not found');
  }
  const pet = findFighter(fighters, step.pet);
  if (!pet) {
    throw new Error('Pet not found');
  }
  // Get random position
  const { x, y } = getRandomPosition(fighters, brute.team);

  // Set pet animation to `run`
  changeAnimation(app, pet, 'run', speed);

  // Move pet to other team
  await Tweener.add({
    target: pet.currentAnimation,
    duration: 0.5 / speed.current,
    ease: Easing.linear,
  }, { x, y });

  // Change pet team
  pet.team = brute.team;
  pet.master = brute.id;

  // Set pet animation to `idle`
  changeAnimation(app, pet, 'idle', speed);
};

export default hypnotise;