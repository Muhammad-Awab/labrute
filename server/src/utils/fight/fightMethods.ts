/* eslint-disable no-param-reassign */
import {
  BARE_HANDS_TEMPO, DetailedFight, DetailedFighter, LeaveStep,
  randomBetween, SHIELD_BLOCK_ODDS, Skill, StepFighter, Weapon,
} from '@labrute/core';
import getDamage from './getDamage.js';

const getMainOpponent = (fightData: DetailedFight['data'], brute: DetailedFighter) => {
  const mainOpponent = fightData.fighters.find(
    (fighter) => fighter.type === 'brute' && !fighter.master && fighter.name !== brute.name,
  );

  if (!mainOpponent) {
    throw new Error('No main opponent found');
  }

  return mainOpponent;
};

export const saboteur = (fightData: DetailedFight['data']) => {
  fightData.fighters.filter((fighter) => fighter.type === 'brute' && !fighter.master).forEach((brute) => {
    if (brute.saboteur) {
      const opponent = getMainOpponent(fightData, brute);

      if (opponent && opponent.weapons.length > 0) {
        const sabotagedWeapon = opponent.weapons[randomBetween(0, opponent.weapons.length - 1)];
        opponent.sabotagedWeapon = sabotagedWeapon;
      }
    }
  });
};

export const orderFighters = (fightData: DetailedFight['data']) => {
  fightData.fighters = fightData.fighters.sort((a, b) => {
    // Last if hp <= 0
    if (a.hp <= 0) return 1;
    if (b.hp <= 0) return -1;
    // Random is initiatives are equal
    if (a.initiative === b.initiative) {
      return Math.random() > 0.5 ? 1 : -1;
    }
    // Lower initiative first
    return a.initiative - b.initiative;
  });
};

export const getOpponents = (fightData: DetailedFight['data'], fighter: DetailedFighter, bruteOnly?: boolean) => {
  let opponents = [];

  // Remove backups not arrived yet
  opponents = fightData.fighters.filter((f) => !f.arrivesAtInitiative);

  // Fighter is a pet/backup
  if (fighter.master) {
    opponents = opponents.filter((f) => (f.master
      ? f.master !== fighter.master
      : f.id !== fighter.master));
  } else {
    // Fighter is a real brute
    opponents = opponents.filter((f) => f.name !== fighter.name
      && f.master !== fighter.id);
  }

  if (bruteOnly) {
    opponents = opponents.filter((f) => f.type === 'brute');
  }

  return opponents;
};

const getRandomOpponent = (fightData: DetailedFight['data'], fighter: DetailedFighter, bruteOnly?: boolean) => {
  const opponents = getOpponents(fightData, fighter, bruteOnly);
  const random = randomBetween(0, opponents.length - 1);

  return opponents[random];
};

const randomlyGetSuper = (fightData: DetailedFight['data'], brute: DetailedFighter) => {
  let supers = brute.skills.filter((skill) => skill.uses);
  if (!supers.length) return null;

  // Filter out tamer if no dead pets
  if (fightData.fighters.filter((fighter) => fighter.type === 'pet' && fighter.hp <= 0).length === 0) {
    supers = supers.filter((skill) => skill.name !== 'tamer');
  }

  // Filter out thief if opponents have no weapons
  if (getOpponents(fightData, brute, true)
    .filter((fighter) => fighter.weapons.length > 0).length === 0) {
    supers = supers.filter((skill) => skill.name !== 'thief');
  }

  // Filter out tragicPotion if not poisoned or lost less than 50 HP
  if (brute.hp > brute.maxHp / 2 && !brute.poisoned) {
    supers = supers.filter((skill) => skill.name !== 'tragicPotion');
  }

  // Filter out cryOfTheDamned and hypnosis if opponent has no pets
  if (fightData.fighters.filter((f) => f.type === 'pet' && f.master === getMainOpponent(fightData, brute).id).length === 0) {
    supers = supers.filter((skill) => skill.name !== 'cryOfTheDamned' && skill.name !== 'hypnosis');
  }

  // Filter out flashFlood if less than 3 weapons
  if (brute.weapons.length < 3) {
    supers = supers.filter((skill) => skill.name !== 'flashFlood');
  }

  const NO_SUPER_TOSS = 10;
  const randomSuper = randomBetween(
    0,
    supers.reduce((acc, skill) => acc + (skill.toss || 0), 0) + NO_SUPER_TOSS,
  );

  let toss = 0;
  for (let i = 0; i < supers.length; i += 1) {
    toss += supers[i].toss || 0;
    if (randomSuper < toss) {
      return supers[i];
    }
  }

  return null;
};

const randomlyDrawWeapon = (weapons: Weapon[]) => {
  if (!weapons.length) return null;

  const NO_WEAPON_TOSS = 10;
  const randomWeapon = randomBetween(
    0,
    weapons.reduce((acc, weapon) => acc + (weapon.toss || 0), 0) + NO_WEAPON_TOSS,
  );

  let toss = 0;
  for (let i = 0; i < weapons.length; i += 1) {
    toss += weapons[i].toss || 0;
    if (randomWeapon < toss) {
      return weapons[i];
    }
  }

  return null;
};

export const stepFighter = (fighter: DetailedFighter): StepFighter => ({
  name: fighter.name,
  type: fighter.type,
  master: fighter.master,
});

const registerHit = (
  fightData: DetailedFight['data'],
  fighter: DetailedFighter,
  opponents: DetailedFighter[],
  damage: number,
  sourceName?: 'hammer' | 'flashFlood' | 'poison' | 'bomb',
) => {
  let actualDamage = damage;

  opponents.forEach((opponent) => {
    // Remove the net and reset initiative
    if (opponent.trapped) {
      opponent.trapped = false;
      opponent.initiative = fightData.initiative + 0.5;
    }

    // Max damage to 20% of opponent's health if `resistant`
    if (opponent.skills.find((sk) => sk.name === 'resistant')) {
      actualDamage = Math.min(damage, Math.floor(opponent.maxHp * 0.2));

      if (actualDamage < damage) {
        // Add resist step
        fightData.steps.push({
          action: 'resist',
          brute: stepFighter(opponent),
        });
      }
    }

    // Reduce backup leave time instead of reducing hp
    if (opponent.leavesAtInitiative) {
      opponent.leavesAtInitiative -= actualDamage * 0.05;
    } else {
      opponent.hp -= actualDamage;
    }
  });

  if (sourceName === 'bomb') {
    // Add bomb step
    fightData.steps.push({
      action: 'bomb',
      fighter: stepFighter(fighter),
      targets: opponents.map((opponent) => stepFighter(opponent)),
      damage: actualDamage,
    });
  } else {
    opponents.forEach((opponent) => {
      // Add hit step
      fightData.steps.push({
        action: sourceName || 'hit',
        fighter: stepFighter(fighter),
        target: stepFighter(opponent),
        weapon: sourceName ? null : fighter.activeWeapon?.name || null,
        damage: actualDamage,
      });
    });
  }

  opponents.forEach((opponent) => {
    // Survive with 1 HP if `survival` skill
    if (opponent.survival && opponent.hp <= 1) {
      opponent.survival = false;
      opponent.hp = 1;

      // Add survival step
      fightData.steps.push({
        action: 'survive',
        brute: stepFighter(opponent),
      });
    }
  });
};

const activateSuper = (fightData: DetailedFight['data'], skill: Skill): boolean => {
  // No uses left (should never happen)
  if (!skill.uses) return false;

  // Get current fighter
  const fighter = fightData.fighters[0];

  switch (skill.name) {
    // Steal opponent's weapon if he has one
    case 'thief': {
      // Choose brute opponent
      const opponent = getRandomOpponent(fightData, fighter, true);

      // Abort if no weapon
      if (!opponent.activeWeapon) return false;

      // 20% chance to steal
      if (randomBetween(0, 4) === 0) {
        // Remove own weapon
        if (fighter.activeWeapon) {
          // Add trash step
          fightData.steps.push({
            action: 'trash',
            brute: stepFighter(fighter),
            name: fighter.activeWeapon.name,
          });

          fighter.activeWeapon = null;
        }

        // Add steal step
        fightData.steps.push({
          action: 'steal',
          brute: stepFighter(fighter),
          name: opponent.activeWeapon.name,
          target: stepFighter(opponent),
        });

        // Set own weapon
        fighter.activeWeapon = opponent.activeWeapon;

        // Remove opponent's weapon
        opponent.activeWeapon = null;

        // Increase opponent initiative
        opponent.initiative += 0.3 + opponent.tempo;
      } else {
        return false;
      }
      break;
    }
    case 'fierceBrute': {
      // Add skill to active skills
      fighter.activeSkills.push(skill);

      // Add skill activation step
      fightData.steps.push({
        action: 'skillActivate',
        brute: stepFighter(fighter),
        skill: skill.name,
      });
      break;
    }
    case 'tragicPotion': {
      const lostHp = fighter.maxHp - fighter.hp;
      const hpHealed = Math.floor(lostHp * (0.25 + Math.random() * 0.25));
      fighter.hp += hpHealed;
      fighter.poisoned = false;

      // Increas own initiative
      fighter.initiative += 0.15;

      // Add heal step
      fightData.steps.push({
        action: 'heal',
        brute: stepFighter(fighter),
        amount: hpHealed,
      });
      break;
    }
    case 'net': {
      // Choose opponent
      const opponent = getRandomOpponent(fightData, fighter);

      // Set opponent's trapped status
      opponent.trapped = true;

      // Increase opponent initiative
      opponent.initiative += 1000;

      // Increase own initiative
      fighter.initiative += 0.2 * fighter.tempo;

      // Add trap step
      fightData.steps.push({
        action: 'trap',
        brute: stepFighter(fighter),
        target: stepFighter(opponent),
      });
      break;
    }
    case 'bomb': {
      // Get opponents
      const opponents = getOpponents(fightData, fighter);

      // Set random bomb damage
      const damage = 15 + randomBetween(0, 10);

      // Hit every opponent
      registerHit(fightData, fighter, opponents, damage, 'bomb');

      // Increase own initiative
      fighter.initiative += 0.5 * fighter.tempo;
      break;
    }
    case 'hammer': {
      // Only 20% to use the skill if fighter has a weapon
      if (fighter.activeWeapon) {
        if (randomBetween(0, 4) === 0) {
          // Add trash step
          fightData.steps.push({
            action: 'trash',
            brute: stepFighter(fighter),
            name: fighter.activeWeapon.name,
          });

          fighter.activeWeapon = null;
        } else {
          return false;
        }
      }

      // Choose opponent
      const opponent = getRandomOpponent(fightData, fighter, true);

      // Add to active skills
      fighter.activeSkills.push(skill);

      // Get damage
      const damage = getDamage(fighter, opponent);
      registerHit(fightData, fighter, [opponent], damage, 'hammer');

      // Increase own initiative
      fighter.initiative += 1 * fighter.tempo;

      // Add skill activation step
      fightData.steps.push({
        action: 'skillActivate',
        brute: stepFighter(fighter),
        skill: skill.name,
      });
      break;
    }
    case 'cryOfTheDamned': {
      // Get main opponent
      const opponent = getMainOpponent(fightData, fighter);
      // Get opponent's pets
      const opponentPets = fightData.fighters.filter((f) => f.type === 'pet' && f.master === opponent.id);

      // Abort if no pet
      if (opponentPets.length === 0) return false;

      // Keep track of fear steps
      const fearSteps = [];

      for (let i = 0; i < opponentPets.length; i++) {
        const pet = opponentPets[i];

        // 33% chance to fear the pet
        if (randomBetween(0, 2) === 0) {
          fearSteps.push({
            action: 'leave',
            fighter: stepFighter(pet),
          } as LeaveStep);

          // Remove pet from fight
          fightData.fighters = fightData.fighters.filter((f) => f.type === 'brute' || (f.type === 'pet' && f.name !== pet.name));
        }
      }

      // Abort if no pet feared
      if (fearSteps.length === 0) return false;

      // Add skill activation step
      fightData.steps.push({
        action: 'skillActivate',
        brute: stepFighter(fighter),
        skill: skill.name,
      });

      // Add fear steps
      fightData.steps = fightData.steps.concat(fearSteps);
      break;
    }
    case 'hypnosis': {
      // Get main opponent
      const opponent = getMainOpponent(fightData, fighter);
      // Get opponent's pets
      const opponentPets = fightData.fighters.filter((f) => f.type === 'pet' && f.master === opponent.id);

      // Keep track of hypnotised pets
      const hypnotisedPets = [];

      for (let i = 0; i < opponentPets.length; i++) {
        const pet = opponentPets[i];

        // Don't hypnotise trapped pets
        if (!pet.trapped) {
          // Add hypnotise step
          fightData.steps.push({
            action: 'hypnotise',
            brute: stepFighter(fighter),
            pet: stepFighter(pet),
          });

          hypnotisedPets.push(pet);

          // Change pet owner
          pet.master = fighter.id;
        }
      }

      // Abort if no pet hypnotised
      if (hypnotisedPets.length === 0) return false;
      break;
    }
    case 'flashFlood': {
      // Choose opponent
      const opponent = getRandomOpponent(fightData, fighter, true);

      // Shuffle weapons
      const shuffledWeapons = [...fighter.weapons].sort(() => Math.random() - 0.5);
      // Get half of the weapons
      const halfWeapons = shuffledWeapons.slice(0, Math.floor(shuffledWeapons.length / 2));

      // Remove those weapons from the fighter
      fighter.weapons = fighter.weapons.filter(
        (w) => !halfWeapons.find((hw) => hw.name === w.name),
      );

      // Add skill activation step
      fightData.steps.push({
        action: 'skillActivate',
        brute: stepFighter(fighter),
        skill: skill.name,
      });

      // Get damages for each weapon
      const damages = [];
      halfWeapons.forEach((w) => {
        const damage = getDamage(fighter, opponent, w);
        damages.push(damage);

        registerHit(fightData, fighter, [opponent], damage, 'flashFlood');
      });

      // Increase own initiative
      fighter.initiative += 2 * fighter.tempo;

      break;
    }
    case 'tamer': {
      // Get dead pets
      const deadPets = fightData.fighters.filter((f) => f.type === 'pet' && f.hp <= 0);

      // Abort if less than 20 HP lost or if no pet is dead
      if (fighter.hp > fighter.maxHp - 20 || !deadPets.length) return false;

      // Get random dead pet
      const pet = deadPets[randomBetween(0, deadPets.length - 1)];

      let healPercentage = 0;
      switch (pet.name) {
        case 'dog1':
        case 'dog2':
        case 'dog3':
          // Heal 20% for a dog
          healPercentage = 0.2;
          break;
        case 'panther':
          // Heal 30% for a panther
          healPercentage = 0.3;
          break;
        case 'bear':
          // Heal 50% for a bear
          healPercentage = 0.5;
          break;
        default:
          return false;
      }

      // Don't overheal
      const heal = Math.min(
        fighter.maxHp - fighter.hp,
        Math.floor(fighter.maxHp * healPercentage),
      );

      // Heal fighter
      fighter.hp += heal;

      // Increase own initiative
      fighter.initiative += 0.15;

      // Add moveTo step
      fightData.steps.push({
        action: 'moveTo',
        fighter: stepFighter(fighter),
        target: stepFighter(pet),
      });
      // Add eat step
      fightData.steps.push({
        action: 'eat',
        brute: stepFighter(fighter),
        target: stepFighter(pet),
        heal,
      });
      // Add moveBack step
      fightData.steps.push({
        action: 'moveBack',
        fighter: stepFighter(fighter),
      });

      break;
    }
    default:
      return false;
  }

  // Spend one use
  skill.uses -= 1;

  // Remove skill if no uses left
  if (!skill.uses) {
    fighter.skills.splice(fighter.skills.findIndex((s) => s.name === skill.name), 1);
  }

  return true;
};

const counterAttack = (fighter: DetailedFighter, opponent: DetailedFighter) => {
  // No counter attack if opponent is dead
  if (opponent.hp <= 0) return false;

  const random = Math.random();

  const valueToBeat = (
    opponent.counter * 10
    + (
      (opponent.activeWeapon?.reach || 0)
      - (fighter.activeWeapon?.reach || 0)
    )
  ) * 0.1;

  return random < valueToBeat;
};

// Returns true if weapon was sabotaged
const drawWeapon = (fightData: DetailedFight['data']): boolean => {
  // Get current fighter
  const fighter = fightData.fighters[0];

  // Don't always draw a weapon if the fighter is already holding a weapon
  if (fighter.activeWeapon && randomBetween(0, fighter.weapons.length * 2) === 0) return false;

  // Draw a weapon
  const possibleWeapon = randomlyDrawWeapon(fighter.weapons);

  // Decrease `keepWeaponChance` each turn and abort until true
  if (Math.random() < fighter.keepWeaponChance) {
    fighter.keepWeaponChance *= 0.5;
    return false;
  }

  // Abort if no weapon drawn
  if (!possibleWeapon) return false;

  // Trash old weapon if there is one
  if (fighter.activeWeapon) {
    // Add trash step
    fightData.steps.push({
      action: 'trash',
      brute: stepFighter(fighter),
      name: fighter.activeWeapon.name,
    });

    // Remove weapon from fighter
    fighter.activeWeapon = null;
  }
  // Equip new weapon
  fighter.activeWeapon = possibleWeapon;

  // Remove weapon from possible weapons
  fighter.weapons = fighter.weapons.filter((w) => w.name !== possibleWeapon.name);

  // Add equip step
  fightData.steps.push({
    action: 'equip',
    brute: stepFighter(fighter),
    name: possibleWeapon.name,
  });

  // Check if weapon was sabotaged
  if (fighter.sabotagedWeapon?.name === possibleWeapon.name) {
    // Add saboteur step
    fightData.steps.push({
      action: 'saboteur',
      brute: stepFighter(fighter),
      weapon: possibleWeapon.name,
    });

    // Remove weapon from fighter
    fighter.activeWeapon = null;
    fighter.sabotagedWeapon = null;

    // Increase own initiative
    fighter.initiative += 1;

    return true;
  }

  return false;
};

const block = (fighter: DetailedFighter, opponent: DetailedFighter, ease = 1) => {
  // No block if opponent is dead
  if (opponent.hp <= 0) return false;

  // No block if opponent is trapped
  if (opponent.trapped) return false;

  // No block for pets
  if (opponent.type === 'pet') return false;

  return Math.random() * ease
    < (opponent.block
      + (opponent.activeWeapon?.block || 0)
      - (fighter.activeWeapon?.accuracy || 0));
};

const evade = (fighter: DetailedFighter, opponent: DetailedFighter, difficulty = 1) => {
  // No evasion if opponent is dead
  if (opponent.hp <= 0) return false;

  // No evasion if opponent is trapped
  if (opponent.trapped) return false;

  // Automatically evade if `balletShoes`
  if (opponent.balletShoes) {
    // Disable ballet shoes
    opponent.balletShoes = false;
    return true;
  }

  // Get agility difference (-40 > diff > 40)
  const agilityDifference = Math.min(
    Math.max(
      -40,
      (opponent.agility - fighter.agility),
    ),
    40,
  );

  const random = Math.random();

  return random * difficulty
    < Math.min(
      (opponent.evasion
        + (opponent.activeWeapon?.evasion || 0)
        + agilityDifference * 0.01
        - fighter.accuracy
        - (fighter.activeWeapon?.accuracy || 0)),
      0.9,
    );
};

const breakShield = (fighter: DetailedFighter, opponent: DetailedFighter) => {
  // Can't break someone's shield if they are not holding a shield >.>
  if (!opponent.shield) return false;

  return (fighter.disarm + (fighter.activeWeapon?.disarm || 0)) * 100 > randomBetween(0, 300);
};

const disarm = (fighter: DetailedFighter, opponent: DetailedFighter) => {
  // Can't disarm someone if they are not holding a weapon >.>
  if (!opponent.activeWeapon) return false;

  return (fighter.disarm + (fighter.activeWeapon?.disarm || 0)) * 100 > randomBetween(0, 100);
};

const disarmAttacker = (fighter: DetailedFighter, opponent: DetailedFighter) => {
  // Can't disarm someone if they are not holding a weapon >.>
  if (!fighter.activeWeapon) return false;

  // Only disarm if opponent has `ironHead`
  if (!opponent.ironHead) return false;

  // 30% chance to disarm the attacker
  return Math.random() < 0.3;
};

const attack = (fightData: DetailedFight['data'], fighter: DetailedFighter, opponent: DetailedFighter) => {
  // Abort if fighter is dead
  if (fighter.hp <= 0) return;

  // Get damage
  let damage = getDamage(fighter, opponent, fighter.activeWeapon || undefined);

  // Add attempt step
  fightData.steps.push({
    action: 'attemptHit',
    fighter: stepFighter(fighter),
    target: stepFighter(opponent),
    weapon: fighter.activeWeapon?.name || null,
  });

  // Check if opponent blocked
  if (block(fighter, opponent)) {
    damage = 0;

    // Add block step
    fightData.steps.push({
      action: 'block',
      fighter: stepFighter(opponent),
    });

    // Auto reversal
    if (opponent.autoReversalOnBlock) {
      // Trigger fighter attack
      attack(fightData, opponent, fighter);
    }
  }

  // Check if opponent evaded
  const evaded = evade(fighter, opponent);
  if (damage && evaded) {
    damage = 0;

    // Add evade step
    fightData.steps.push({
      action: 'evade',
      fighter: stepFighter(opponent),
    });
  }

  // Check if opponent's shield was broken
  if (!evaded && breakShield(fighter, opponent)) {
    // Remove shield from opponent
    opponent.shield = false;
    opponent.block -= SHIELD_BLOCK_ODDS;

    // Add break step
    fightData.steps.push({
      action: 'break',
      fighter: stepFighter(fighter),
      opponent: stepFighter(opponent),
    });
  }

  // Check if the fighter sabotages an opponent's weapon
  if (damage && fighter.sabotage) {
    if (opponent.weapons.length) {
      // Remove a random weapon
      const weapon = opponent.weapons.splice(randomBetween(0, opponent.weapons.length - 1), 1)[0];

      // Add sabotage step
      fightData.steps.push({
        action: 'sabotage',
        fighter: stepFighter(fighter),
        opponent: stepFighter(opponent),
        weapon: weapon.name,
      });
    }
  }

  // Check if the fighter disarms the opponent
  if (damage && disarm(fighter, opponent)) {
    if (opponent.activeWeapon) {
      // Add disarm step
      fightData.steps.push({
        action: 'disarm',
        fighter: stepFighter(fighter),
        opponent: stepFighter(opponent),
        weapon: opponent.activeWeapon.name,
      });

      // Remove weapon from opponent
      opponent.activeWeapon = null;
    }
  }

  // Check if the fighter gets disarmed
  if (damage && disarmAttacker(fighter, opponent)) {
    if (fighter.activeWeapon) {
      // Add disarm step
      fightData.steps.push({
        action: 'disarm',
        fighter: stepFighter(opponent),
        opponent: stepFighter(fighter),
        weapon: fighter.activeWeapon.name,
      });

      // Remove weapon from fighter
      fighter.activeWeapon = null;
    }
  }

  // Register hit if damage was done
  if (damage) {
    registerHit(fightData, fighter, [opponent], getDamage(fighter, opponent));
  }

  // Randomly trigger another attack if the fighter has `determination`
  if (!damage && fighter.determination && Math.random() < 0.7) {
    fighter.retryAttack = true;
  }
};

export const checkDeaths = (fightData: DetailedFight['data']) => {
  for (let i = 0; i < fightData.fighters.length; i++) {
    const fighter = fightData.fighters[i];

    if (fighter.hp <= 0) {
      // Add death step
      fightData.steps.push({
        action: 'death',
        fighter: stepFighter(fighter),
      });

      // Remove fighter from fight
      const [deadFighter] = fightData.fighters.splice(i, 1);

      // Set loser if fighter is a main brute
      if (deadFighter.type === 'brute' && !deadFighter.master) {
        fightData.loser = stepFighter(deadFighter);
      }
      i -= 1;
    }
  }
};

const reversal = (opponent: DetailedFighter) => {
  // Only reverse if the opponent has `reversal`
  if (!opponent.reversal) return false;

  // Auto reverse
  if (opponent.autoReversalOnBlock) {
    return true;
  }

  const random = Math.random();

  return random < opponent.reversal + (opponent.activeWeapon?.counter || 0);
};

const startAttack = (
  fightData: DetailedFight['data'],
  fighter: DetailedFighter,
  opponent: DetailedFighter,
  isCounter?: boolean,
) => {
  // Trigger fighter attack
  attack(fightData, fighter, opponent);

  // Get combo chances
  let combo = fighter.combo + (fighter.activeWeapon?.combo || 0) + (fighter.agility * 0.01);

  // Keep track of initial fighter HP
  const initialFighterHp = fighter.hp;

  // Check if opponent is not trapped and can reverse
  if (!opponent.trapped && reversal(opponent)) {
    // Trigger opponent attack
    attack(fightData, opponent, fighter);
  }

  // Repeat attack only if not countering
  if (!isCounter) {
    let random = Math.random();
    while (random < combo || fighter.retryAttack) {
      // Stop the combo if the fighter took a hit
      if (fighter.hp < initialFighterHp) {
        break;
      }

      // Decrease combo chances
      combo *= 0.5;
      // Reset retry attack flag
      fighter.retryAttack = false;

      // Trigger fighter attack
      attack(fightData, fighter, opponent);

      random = Math.random();

      // Check if opponent is not trapped and can reverse
      if (!opponent.trapped && reversal(opponent)) {
        // Trigger opponent attack
        attack(fightData, opponent, fighter);
      }
    }
  }

  // Check if a fighter is dead
  checkDeaths(fightData);
};

export const playFighterTurn = (fightData: DetailedFight['data']) => {
  const fighter = fightData.fighters[0];

  // Check if backup should leave
  if (fighter.leavesAtInitiative && fighter.leavesAtInitiative <= fightData.initiative) {
    // Add backup leave step
    fightData.steps.push({
      action: 'leave',
      fighter: stepFighter(fighter),
    });

    fightData.fighters.shift();
    return;
  }

  // Check if backup should arrive
  if (fighter.arrivesAtInitiative) {
    fighter.arrivesAtInitiative = undefined;

    // Add backup arrive step
    fightData.steps.push({
      action: 'arrive',
      fighter: stepFighter(fighter),
    });
  }

  // Super activation
  const possibleSuper = randomlyGetSuper(fightData, fighter);
  if (possibleSuper) {
    // End turn if super activated
    if (activateSuper(fightData, possibleSuper)) {
      return;
    }
  }

  // Draw weapon
  const sabotaged = drawWeapon(fightData);

  // End turn if weapon was sabotaged
  if (sabotaged) {
    return;
  }

  // Get attack type (more chances to throw a weapon the less damage it does)
  const attackType = fighter.activeWeapon?.types.includes('thrown')
    ? 'thrown'
    : fighter.activeWeapon
      ? randomBetween(0, fighter.activeWeapon.damage) === 0
        ? 'thrown' : 'melee'
      : 'melee';

  // Get opponent
  const opponent = getRandomOpponent(fightData, fighter);

  // Melee attack
  if (attackType === 'melee') {
    // Add moveTo step
    fightData.steps.push({
      action: 'moveTo',
      fighter: stepFighter(fighter),
      target: stepFighter(opponent),
    });

    // Check if opponent is not trapped and countered
    if (!opponent.trapped && counterAttack(fighter, opponent)) {
      // Add counter step
      fightData.steps.push({
        action: 'counter',
        fighter: stepFighter(opponent),
        opponent: stepFighter(fighter),
      });

      // Opponent attacks fighter
      startAttack(fightData, opponent, fighter, true);
    } else {
      // Fighter attacks opponent
      startAttack(fightData, fighter, opponent);
    }

    // Check if fighter is not dead
    if (fighter.hp > 0) {
      // Add moveBack step
      fightData.steps.push({
        action: 'moveBack',
        fighter: stepFighter(fighter),
      });
    }
  } else {
    // Throw attack
    if (!fighter.activeWeapon) {
      throw new Error('Trying to throw a weapon but no weapon is active');
    }

    // Get damage
    let damage = getDamage(fighter, opponent, fighter.activeWeapon);

    // Add throw step
    fightData.steps.push({
      action: 'throw',
      fighter: stepFighter(fighter),
      opponent: stepFighter(opponent),
      weapon: fighter.activeWeapon.name,
    });

    // Check if opponent blocked (harder than melee)
    if (block(fighter, opponent, 2)) {
      damage = 0;

      // Add block step
      fightData.steps.push({
        action: 'block',
        fighter: stepFighter(opponent),
      });
    }

    // Check if opponent evaded (harder than melee)
    if (damage && evade(fighter, opponent, 2)) {
      damage = 0;

      // Add evade step
      fightData.steps.push({
        action: 'evade',
        fighter: stepFighter(opponent),
      });
    }

    // Register hit if damage was done
    if (damage) {
      registerHit(fightData, fighter, [opponent], damage);
    }

    // Remove fighter weapon if it is not a thrown weapon
    if (!fighter.activeWeapon.types.includes('thrown')) {
      fighter.activeWeapon = null;
    }

    // Check if a fighter is dead
    checkDeaths(fightData);
  }

  // Check if fighter is poisoned
  if (fighter.hp > 0 && fighter.poisoned) {
    // Get poison damage
    const poisonDamage = Math.ceil(fighter.maxHp / 50);

    // Register the hit
    registerHit(fightData, fighter, [fighter], poisonDamage, 'poison');
  }

  // Increase own initiative
  const random = randomBetween(0, 10);
  let tempo = (fighter.activeWeapon?.tempo || BARE_HANDS_TEMPO)
    * fighter.tempo
    + (random / 100);

  // Reduce tempo lost if fighter has `bodybuilder` and is using a heavy weapon
  if (fighter.activeWeapon && fighter.bodybuilder && fighter.activeWeapon.types.includes('heavy')) {
    tempo *= 0.75;
  }

  // Increase tempo lost if fighter has `monk`
  if (fighter.monk) {
    tempo *= 2;
  }

  fighter.initiative += tempo;

  // Remove active skills
  fighter.activeSkills.forEach((skill) => {
    // Add skill expire step
    fightData.steps.push({
      action: 'skillExpire',
      brute: stepFighter(fighter),
      skill: skill.name,
    });
  });
  fighter.activeSkills = [];
};