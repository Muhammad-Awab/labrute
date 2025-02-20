import {
  ARENA_OPPONENTS_COUNT, BrutesExistsResponse, BrutesGetDestinyResponse, BrutesGetForRankResponse,
  BrutesGetRankingResponse,
  BruteWithBodyColors, createRandomBruteStats,
  DestinyBranch, ExpectedError, getLevelUpChoices, getSacriPoints, getXPNeeded, updateBruteData,
} from '@labrute/core';
import {
  DestinyChoiceSide, DestinyChoiceType, Gender, Prisma, PrismaClient,
} from '@labrute/prisma';
import { Request, Response } from 'express';
import moment from 'moment';
import { Worker } from 'worker_threads';
import auth from '../utils/auth.js';
import checkBody from '../utils/brute/checkBody.js';
import checkColors from '../utils/brute/checkColors.js';
import getOpponents from '../utils/brute/getOpponents.js';
import sendError from '../utils/sendError.js';

const Brutes = {
  list: (prisma: PrismaClient) => async (req: Request, res: Response) => {
    try {
      await auth(prisma, req);

      const brutes = await prisma.brute.findMany({
        where: {
          deletedAt: null,
        },
      });

      res.send(brutes);
    } catch (error) {
      sendError(res, error);
    }
  },
  get: (prisma: PrismaClient) => async (
    req: Request<{
      name: string
    }, unknown, {
      include: Prisma.BruteInclude,
      where: Prisma.BruteWhereInput
    }>,
    res: Response,
  ) => {
    try {
      const brute = await prisma.brute.findFirst({
        where: {
          ...req.body.where,
          name: req.params.name,
          deletedAt: null,
        },
        include: req.body.include,
      });

      if (!brute) {
        throw new ExpectedError('Brute not found');
      }

      res.send(brute);
    } catch (error) {
      sendError(res, error);
    }
  },
  isNameAvailable: (prisma: PrismaClient) => async (req: Request, res: Response) => {
    try {
      await auth(prisma, req);

      const count = await prisma.brute.count({
        where: {
          name: req.params.name,
          deletedAt: null,
        },
      });

      res.status(200).send(count === 0);
    } catch (error) {
      sendError(res, error);
    }
  },
  create: (prisma: PrismaClient) => async (
    req: Request<never, unknown, {
      name: string,
      user: string,
      gender: Gender,
      body: Prisma.BruteBodyCreateWithoutBruteInput,
      colors: Prisma.BruteColorsCreateWithoutBruteInput,
      master: string | null,
    }>,
    res: Response,
  ) => {
    try {
      const user = await auth(prisma, req);

      // Check colors validity
      checkColors(req.body.gender, req.body.colors);

      // Check body validity
      checkBody(req.body.gender, req.body.body);

      // Check if name is available
      const count = await prisma.brute.count({
        where: {
          name: req.body.name,
          deletedAt: null,
        },
      });

      if (count > 0) {
        throw new ExpectedError('This name is already taken');
      }

      // Get brute amount for user
      const bruteCount = await prisma.brute.count({
        where: {
          userId: user.id,
          deletedAt: null,
        },
      });

      let pointsLost = 0;
      // Refuse if user has too many brutes and not enough points
      if (bruteCount >= user.bruteLimit) {
        if (user.sacrificePoints < 500) {
          throw new ExpectedError('You have reached your brute limit. You need 500 Sacripoints to unlock a new brute.');
        } else {
          // Remove 500 sacrifice points and update brute limit
          await prisma.user.update({
            where: { id: user.id },
            data: {
              sacrificePoints: { decrement: 500 },
              bruteLimit: { increment: 1 },
            },
          });
          pointsLost = 500;
        }
      }

      const master = req.body.master ? await prisma.brute.findFirst({
        where: {
          name: req.body.master,
          deletedAt: null,
          userId: {
            not: user.id,
          },
        },
        select: { id: true },
      }) : undefined;

      // Create brute
      const brute = await prisma.brute.create({
        data: {
          name: req.body.name,
          ...createRandomBruteStats(),
          gender: req.body.gender,
          user: { connect: { id: user.id } },
          body: { create: req.body.body },
          colors: { create: req.body.colors },
          master: master ? { connect: { id: master.id } } : undefined,
        },
        include: { body: true, colors: true },
      });

      // Get first bonus type
      const firstBonusType = brute.skills.length
        ? DestinyChoiceType.skill
        : brute.weapons.length
          ? DestinyChoiceType.weapon
          : DestinyChoiceType.pet;

      // Store first bonus
      await prisma.destinyChoice.create({
        data: {
          type: firstBonusType,
          pet: firstBonusType === DestinyChoiceType.pet
            ? brute.pets[0] : undefined,
          skill: firstBonusType === DestinyChoiceType.skill
            ? brute.skills[0] : undefined,
          weapon: firstBonusType === DestinyChoiceType.weapon
            ? brute.weapons[0] : undefined,
          bruteId: brute.id,
          path: [],
        },
      });

      // Update master's pupils count
      if (master) {
        await prisma.brute.update({
          where: { id: master.id },
          data: { pupilsCount: { increment: 1 } },
        });

        // Add log
        await prisma.log.create({
          data: {
            currentBrute: { connect: { id: master.id } },
            type: 'child',
            brute: brute.name,
          },
        });
      }

      // Generate spritesheet
      // eslint-disable-next-line no-new
      new Worker('./lib/workers/generateSpritesheet.js', {
        workerData: brute,
      });

      res.send({ brute, pointsLost });
    } catch (error) {
      sendError(res, error);
    }
  },
  getLevelUpChoices: (prisma: PrismaClient) => async (req: Request, res: Response) => {
    try {
      const user = await auth(prisma, req);

      // Get brute
      const brute = await prisma.brute.findFirst({
        where: {
          name: req.params.name,
          userId: user.id,
          deletedAt: null,
        },
        include: { body: true, colors: true },
      });
      if (!brute) {
        throw new Error('Brute not found');
      }

      const firstChoicePath = [...brute.destinyPath, DestinyChoiceSide.LEFT];
      const secondChoicePath = [...brute.destinyPath, DestinyChoiceSide.RIGHT];

      // Get destiny choices
      let firstDestinyChoice = await prisma.destinyChoice.findFirst({
        where: {
          bruteId: brute.id,
          path: { equals: firstChoicePath },
        },
      });
      let secondDestinyChoice = await prisma.destinyChoice.findFirst({
        where: {
          bruteId: brute.id,
          path: { equals: secondChoicePath },
        },
      });

      if (!firstDestinyChoice || !secondDestinyChoice) {
        const newChoices = getLevelUpChoices(brute);

        // Create destiny choices
        const newFirstDestinyChoice = await prisma.destinyChoice.create({
          data: {
            ...newChoices[0],
            path: firstChoicePath,
            brute: { connect: { id: brute.id } },
          },
        });
        firstDestinyChoice = newFirstDestinyChoice;

        const newSecondDestinyChoice = await prisma.destinyChoice.create({
          data: {
            ...newChoices[1],
            path: secondChoicePath,
            brute: { connect: { id: brute.id } },
          },
        });
        secondDestinyChoice = newSecondDestinyChoice;
      }

      res.send({
        brute,
        choices: [firstDestinyChoice, secondDestinyChoice],
      });
    } catch (error) {
      sendError(res, error);
    }
  },
  levelUp: (prisma: PrismaClient) => async (
    req: Request<{ name: string }, unknown, { choice: DestinyChoiceSide }>,
    res: Response,
  ) => {
    try {
      const user = await auth(prisma, req);

      // Get brute
      let brute = await prisma.brute.findFirst({
        where: {
          name: req.params.name,
          userId: user.id,
          deletedAt: null,
        },
      });

      if (!brute) {
        throw new Error('Brute not found');
      }

      // Check if brute has enough XP
      if (brute.xp < getXPNeeded(brute.level + 1)) {
        throw new ExpectedError('Not enough XP');
      }

      // Get destiny choice
      const destinyChoice = await prisma.destinyChoice.findFirst({
        where: {
          bruteId: brute.id,
          path: { equals: [...brute.destinyPath, req.body.choice] },
        },
      });

      if (!destinyChoice) {
        throw new Error('Destiny choice not found');
      }

      // Update brute data
      const updatedBruteData = updateBruteData(brute, destinyChoice);

      // Update brute
      brute = await prisma.brute.update({
        where: { id: brute.id },
        data: {
          ...updatedBruteData,
          destinyPath: { push: req.body.choice },
        },
      });

      // Get new opponents
      const opponents = await getOpponents(prisma, brute);

      // Save opponents
      await prisma.brute.update({
        where: {
          id: brute.id,
        },
        data: {
          opponents: {
            set: opponents.map((o) => ({
              id: o.id,
            })),
          },
          // Update opponentsGeneratedAt
          opponentsGeneratedAt: new Date(),
        },
      });

      // Add log
      await prisma.log.create({
        data: {
          currentBrute: { connect: { id: brute.id } },
          type: 'up',
        },
      });

      if (brute.masterId) {
        // Add log to master
        await prisma.log.create({
          data: {
            currentBrute: { connect: { id: brute.masterId } },
            type: 'childup',
            brute: brute.name,
          },
        });
      }

      res.send({});
    } catch (error) {
      sendError(res, error);
    }
  },
  getOpponents: (prisma: PrismaClient) => async (
    req: Request,
    res: Response<BruteWithBodyColors[]>,
  ) => {
    try {
      const user = await auth(prisma, req);

      // Get brute
      const brute = await prisma.brute.findFirst({
        where: {
          name: req.params.name,
          deletedAt: null,
          userId: user.id,
        },
        include: { opponents: { include: { body: true, colors: true } } },
      });

      if (!brute) {
        throw new Error('Brute not found');
      }

      // Handle deleted opponents
      let opponents = brute.opponents.filter((o) => o.deletedAt === null);

      // If never generated today or not enough opponents, reset opponents
      if (!brute.opponentsGeneratedAt || moment.utc(brute.opponentsGeneratedAt).isBefore(moment.utc().startOf('day')) || opponents.length < ARENA_OPPONENTS_COUNT) {
        // Get opponents
        opponents = await getOpponents(prisma, brute);

        // Save opponents
        await prisma.brute.update({
          where: {
            id: brute.id,
          },
          data: {
            opponents: {
              set: opponents.map((o) => ({
                id: o.id,
              })),
            },
            // Update opponentsGeneratedAt
            opponentsGeneratedAt: new Date(),
          },
        });
      }

      res.send(opponents);
    } catch (error) {
      sendError(res, error);
    }
  },
  sacrifice: (prisma: PrismaClient) => async (req: Request, res: Response) => {
    try {
      const user = await auth(prisma, req);

      // Get brute
      const brute = await prisma.brute.findFirst({
        where: {
          name: req.params.name,
          userId: user.id,
          deletedAt: null,
        },
      });

      if (!brute) {
        throw new Error('Brute not found');
      }

      // Prevent sacrificing the day of creation
      if (moment.utc().isSame(moment.utc(brute.createdAt), 'day')) {
        throw new ExpectedError('You cannot sacrifice your brute the day of creation');
      }

      // Add SacriPoints to user
      const sacriPoints = getSacriPoints(brute);
      await prisma.user.update({
        where: { id: user.id },
        data: {
          sacrificePoints: { increment: sacriPoints },
        },
      });

      // Decrease master's pupils count
      if (brute.masterId) {
        await prisma.brute.update({
          where: { id: brute.masterId },
          data: {
            pupilsCount: { decrement: 1 },
          },
        });
      }

      // Remove pupils master
      await prisma.brute.updateMany({
        where: { masterId: brute.id },
        data: {
          masterId: null,
        },
      });

      // Completely delete if fresh brute
      const fightsFought = await prisma.fight.count({
        where: {
          OR: [
            { brute1Id: brute.id },
            { brute2Id: brute.id },
          ],
        },
      });
      if (fightsFought === 0) {
        // Delete body
        if (await prisma.bruteBody.count({ where: { bruteId: brute.id } })) {
          await prisma.bruteBody.delete({
            where: { bruteId: brute.id },
          });
        }
        // Delete colors
        if (await prisma.bruteColors.count({ where: { bruteId: brute.id } })) {
          await prisma.bruteColors.delete({
            where: { bruteId: brute.id },
          });
        }
        // Delete spritesheet
        if (await prisma.bruteSpritesheet.count({ where: { bruteId: brute.id } })) {
          await prisma.bruteSpritesheet.delete({
            where: { bruteId: brute.id },
          });
        }
        // Delete logs
        if (await prisma.log.count({ where: { currentBruteId: brute.id } })) {
          await prisma.log.deleteMany({
            where: { currentBruteId: brute.id },
          });
        }
        // Delete destiny choices
        if (await prisma.destinyChoice.count({ where: { bruteId: brute.id } })) {
          await prisma.destinyChoice.deleteMany({
            where: { bruteId: brute.id },
          });
        }
        await prisma.brute.delete({
          where: { id: brute.id },
        });
      } else {
        // Set brute as deleted
        await prisma.brute.update({
          where: { id: brute.id },
          data: {
            deletedAt: new Date(),
          },
        });
      }

      res.send({ points: sacriPoints });
    } catch (error) {
      sendError(res, error);
    }
  },
  isReadyToFight: (prisma: PrismaClient) => async (req: Request, res: Response) => {
    try {
      await auth(prisma, req);

      // Check if brute has a spritesheet
      const count = await prisma.bruteSpritesheet.count({
        where: { brute: { name: req.params.name, deletedAt: null } },
      });

      res.send(count === 1);
    } catch (error) {
      sendError(res, error);
    }
  },
  getForRank: (prisma: PrismaClient) => async (
    req: Request<{
      name?: string
      rank?: string
    }, unknown, never>,
    res: Response,
  ) => {
    try {
      if (!req.params.name) {
        throw new Error('Missing name');
      }

      let rank: number;

      // Get brute rank if not provided
      if (typeof req.params.rank === 'undefined') {
        const brute = await prisma.brute.findFirst({
          where: { name: req.params.name, deletedAt: null },
          select: { ranking: true },
        });

        if (!brute) {
          throw new ExpectedError('Brute not found');
        }
        rank = brute.ranking;
      } else {
        rank = +req.params.rank;
      }

      // Get first 15 brutes of the same rank with the highest level and XP
      const topBrutes = await prisma.brute.findMany({
        where: {
          ranking: rank,
          deletedAt: null,
          userId: { not: null },
        },
        orderBy: [
          { level: 'desc' },
          { xp: 'desc' },
        ],
        take: 15,
        include: { body: true, colors: true },
      });

      const result: BrutesGetForRankResponse = {
        topBrutes,
        nearbyBrutes: [],
        position: 0,
      };

      // If current brute is not in the list, get it
      if (!topBrutes.find((b) => b.name === req.params.name)) {
        const brute = await prisma.brute.findFirst({
          where: {
            name: req.params.name,
            ranking: rank,
            deletedAt: null,
          },
          include: { body: true, colors: true },
        });

        // Don't rank bot brutes
        if (brute && brute.userId) {
          // Find the brute position in the list
          const position = await prisma.brute.count({
            where: {
              ranking: rank,
              deletedAt: null,
              name: { not: brute.name },
              userId: { not: null },
              OR: [
                { level: { gt: brute.level } },
                { level: brute.level, xp: { gt: brute.xp } },
              ],
            },
          });

          // Find the brutes around the current brute
          const nearbyHigherBrutes = await prisma.brute.findMany({
            where: {
              ranking: rank,
              deletedAt: null,
              name: { not: brute.name },
              userId: { not: null },
              OR: [
                { level: { gt: brute.level } },
                { level: brute.level, xp: { gt: brute.xp } },
              ],
            },
            orderBy: [
              { level: 'asc' },
              { xp: 'asc' },
            ],
            take: 2,
            include: { body: true, colors: true },
          });

          const nearbyLowerBrutes = await prisma.brute.findMany({
            where: {
              ranking: rank,
              deletedAt: null,
              name: { not: brute.name },
              userId: { not: null },
              OR: [
                { level: { lt: brute.level } },
                { level: brute.level, xp: { lte: brute.xp } },
              ],
            },
            orderBy: [
              { level: 'desc' },
              { xp: 'desc' },
            ],
            take: 2,
            include: { body: true, colors: true },
          });

          result.nearbyBrutes = [
            ...nearbyHigherBrutes
              .filter((b) => !topBrutes.find((t) => t.name === b.name))
              .reverse(),
            brute,
            ...nearbyLowerBrutes,
          ];
          result.position = position + 1;
        }
      }

      res.send(result);
    } catch (error) {
      sendError(res, error);
    }
  },
  getRanking: (prisma: PrismaClient) => async (
    req: Request<{
      name?: string
    }, unknown, never>,
    res: Response<BrutesGetRankingResponse>,
  ) => {
    try {
      const { params: { name } } = req;

      if (!name) {
        throw new Error('Missing name');
      }

      // Get the brute ranking
      const brute = await prisma.brute.findFirst({
        where: { name, deletedAt: null },
        select: {
          ranking: true, level: true, xp: true, userId: true,
        },
      });

      if (!brute) {
        throw new ExpectedError('Brute not found');
      }

      // Don't rank bot brutes
      if (!brute.userId) {
        res.send({
          ranking: 0,
        });
        return;
      }

      const rank = brute.ranking;

      // Find the brute position
      const position = await prisma.brute.count({
        where: {
          ranking: rank,
          deletedAt: null,
          name: { not: name },
          userId: { not: null },
          OR: [
            { level: { gt: brute.level } },
            { level: brute.level, xp: { gt: brute.xp } },
          ],
        },
      });

      res.send({
        ranking: position + 1,
      });
    } catch (error) {
      sendError(res, error);
    }
  },
  exists: (prisma: PrismaClient) => async (
    req: Request,
    res: Response<BrutesExistsResponse>,
  ) => {
    try {
      const { params: { name } } = req;

      if (!name) {
        throw new Error('Missing name');
      }

      let brute = await prisma.brute.findFirst({
        where: { name, deletedAt: null },
        select: { name: true },
      });

      if (!brute) {
        // Try case insensitive
        brute = await prisma.brute.findFirst({
          where: { name: { equals: name, mode: 'insensitive' }, deletedAt: null },
          select: { name: true },
        });

        if (!brute) {
          res.send({
            exists: false,
          });
          return;
        }
      }

      res.send({
        exists: true,
        name: brute.name,
      });
    } catch (error) {
      sendError(res, error);
    }
  },
  rankUp: (prisma: PrismaClient) => async (
    req: Request,
    res: Response,
  ) => {
    try {
      const { params: { name } } = req;

      const user = await auth(prisma, req);

      if (!name) {
        throw new Error('Missing name');
      }

      let brute = await prisma.brute.findFirst({
        where: {
          name,
          deletedAt: null,
          userId: user.id,
        },
      });

      if (!brute) {
        throw new Error('Brute not found');
      }

      if (!brute.canRankUp) {
        throw new ExpectedError('Brute cannot rank up');
      }

      if (brute.ranking === 0) {
        throw new ExpectedError('Brute is already at the highest rank');
      }

      // Get first bonus
      const bonus = await prisma.destinyChoice.findFirst({
        where: {
          bruteId: brute.id,
          path: { equals: [] },
        },
      });

      if (!bonus) {
        throw new Error('Brute has no first bonus');
      }

      // Update the brute
      brute = await prisma.brute.update({
        where: { id: brute.id },
        data: {
          // Random stats
          ...createRandomBruteStats(
            bonus.type,
            bonus.type === DestinyChoiceType.pet
              ? bonus.pet
              : bonus.type === DestinyChoiceType.weapon
                ? bonus.weapon
                : bonus.skill,
          ),
          // Rank up
          ranking: brute.ranking - 1,
          canRankUp: false,
          // Reset destiny
          destinyPath: [],
        },
      });

      // Get new opponents
      const opponents = await getOpponents(prisma, brute);

      // Save opponents
      await prisma.brute.update({
        where: {
          id: brute.id,
        },
        data: {
          opponents: {
            set: opponents.map((o) => ({
              id: o.id,
            })),
          },
          // Update opponentsGeneratedAt
          opponentsGeneratedAt: new Date(),
        },
      });

      res.send({
        success: true,
      });
    } catch (error) {
      sendError(res, error);
    }
  },
  getDestiny: (prisma: PrismaClient) => async (
    req: Request,
    res: Response<BrutesGetDestinyResponse>,
  ) => {
    try {
      const { params: { name } } = req;

      if (!name) {
        throw new Error('Missing name');
      }

      const brute = await prisma.brute.findFirst({
        where: { name, deletedAt: null },
      });

      if (!brute) {
        throw new Error('Brute not found');
      }

      const destinyChoices = await prisma.destinyChoice.findMany({
        where: { bruteId: brute.id },
      });

      // Get Destiny tree
      const getBranchRecursive = (path: DestinyChoiceSide[]) => {
        const destinyChoice = destinyChoices.find((c) => c.path.join(',') === path.join(','));

        if (!destinyChoice) {
          return null;
        }

        const branch: DestinyBranch = {
          ...destinyChoice,
          [DestinyChoiceSide.LEFT]: getBranchRecursive(
            [...path, DestinyChoiceSide.LEFT],
          ),
          [DestinyChoiceSide.RIGHT]: getBranchRecursive(
            [...path, DestinyChoiceSide.RIGHT],
          ),
        };

        return branch;
      };

      // Create Destiny tree
      const firstBonus = destinyChoices.find((c) => c.path.length === 0);

      if (!firstBonus) {
        throw new Error('Brute has no first bonus');
      }

      const destinyTree: DestinyBranch = {
        ...firstBonus,
        [DestinyChoiceSide.LEFT]: getBranchRecursive(
          [DestinyChoiceSide.LEFT],
        ) as DestinyBranch,
        [DestinyChoiceSide.RIGHT]: getBranchRecursive(
          [DestinyChoiceSide.RIGHT],
        ) as DestinyBranch,
      };

      res.send(destinyTree);
    } catch (error) {
      sendError(res, error);
    }
  },
};

export default Brutes;
