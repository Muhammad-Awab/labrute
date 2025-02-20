import React from 'react';
import ProvideBrute from './components/Brute/ProvideBrute';
import Main from './layouts/Main';
import AdminView from './views/AdminView';
import AnchorTestView from './views/AnchorTestView';
import ArenaView from './views/ArenaView';
import CellView from './views/CellView';
import DestinyView from './views/DestinyView';
import FightView from './views/FightView';
import HomeView from './views/HomeView';
import LevelUpView from './views/LevelUpView';
import RankingView from './views/RankingView';
import TournamentView from './views/TournamentView';
import VersusView from './views/VersusView';

const routes = [
  { path: 'anchor-test', element: <AnchorTestView /> },
  {
    path: '/',
    element: <Main />,
    children: [
      { path: '', element: <HomeView /> },
      { path: 'oauth/callback', element: <HomeView /> },
      { path: 'admin-panel', element: <AdminView /> },
      {
        path: ':bruteName',
        children: [
          {
            path: 'cell',
            element: <ProvideBrute />,
            children: [
              { path: '', element: <CellView /> },
            ],
          },
          { path: 'level-up', element: <LevelUpView /> },
          { path: 'arena', element: <ArenaView /> },
          { path: 'versus/:opponentName', element: <VersusView /> },
          { path: 'fight/:fightId', element: <FightView /> },
          { path: 'tournament/:date', element: <TournamentView /> },
          { path: 'ranking', element: <RankingView /> },
          { path: 'ranking/:rank', element: <RankingView /> },
          { path: 'destiny', element: <DestinyView /> },
        ],
      },
    ],
  },
];

export default routes;
