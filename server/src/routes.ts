/* eslint-disable @typescript-eslint/no-misused-promises */
import { PrismaClient } from '@labrute/prisma';
import { Express, Request, Response } from 'express';
import Brutes from './controllers/Brutes.js';
import Fights from './controllers/Fights.js';
import Logs from './controllers/Logs.js';
import OAuth from './controllers/OAuth.js';
import Spritesheets from './controllers/Spritesheets.js';
import Tournaments from './controllers/Tournaments.js';
import Users from './controllers/Users.js';

const initRoutes = (app: Express, prisma: PrismaClient) => {
  app.get('/api', (req: Request, res: Response) => res.status(200).send({
    message: 'server is running!',
  }));

  // OAuth
  app.get('/api/oauth/redirect', OAuth.redirect);
  app.get('/api/oauth/token', OAuth.token(prisma));

  // User
  app.post('/api/user/authenticate', Users.authenticate(prisma));
  app.get('/api/run-daily-job', Users.runDailyJob(prisma));

  // Brute
  app.get('/api/brute/list', Brutes.list(prisma));
  app.post('/api/brute/:name/get', Brutes.get(prisma));
  app.get('/api/brute/:name/available', Brutes.isNameAvailable(prisma));
  app.get('/api/brute/:name/ready', Brutes.isReadyToFight(prisma));
  app.post('/api/brute/create', Brutes.create(prisma));
  app.get('/api/brute/:name/level-up-choices', Brutes.getLevelUpChoices(prisma));
  app.post('/api/brute/:name/level-up', Brutes.levelUp(prisma));
  app.get('/api/brute/:name/get-opponents/:level', Brutes.getOpponents(prisma));
  app.get('/api/brute/:name/sacrifice', Brutes.sacrifice(prisma));
  app.get('/api/brute/:name/ranking-data/:rank', Brutes.getForRank(prisma));
  app.get('/api/brute/:name/ranking-data', Brutes.getForRank(prisma));
  app.get('/api/brute/:name/ranking', Brutes.getRanking(prisma));
  app.get('/api/brute/:name/exists', Brutes.exists(prisma));
  app.get('/api/brute/:name/rank-up', Brutes.rankUp(prisma));
  app.get('/api/brute/:name/destiny', Brutes.getDestiny(prisma));

  // Log
  app.get('/api/log/list/:name', Logs.list(prisma));

  // Fight
  app.get('/api/fight/:name/:id', Fights.get(prisma));
  app.post('/api/fight/create', Fights.create(prisma));

  // Spritesheet
  app.get('/api/spritesheet/:brute.png', Spritesheets.getImage(prisma));
  app.get('/api/spritesheet/:brute.json', Spritesheets.getJson(prisma));
  app.get('/api/spritesheet/:brute/:model/:animation/:frame', Spritesheets.getFrame(prisma));
  app.get('/api/spritesheet/:brute/:model/:animation', Spritesheets.getAnimation(prisma));

  // Tournament
  app.get('/api/tournament/:name/register', Tournaments.registerDaily(prisma));
  app.get('/api/tournament/:name/update-step-watched', Tournaments.updateStepWatched(prisma));
  app.get('/api/tournament/:name/set-daily-watched', Tournaments.setDailyWatched(prisma));
  app.get('/api/tournament/global/:name/:date', Tournaments.getGlobal(prisma));
  app.get('/api/tournament/:name/:date', Tournaments.getDaily(prisma));
  app.delete('/api/tournament/daily', Tournaments.deleteDaily(prisma));
  app.delete('/api/tournament/global', Tournaments.deleteGlobal(prisma));
};

export default initRoutes;
