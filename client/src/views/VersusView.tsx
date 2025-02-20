import { BruteWithBodyColors, getXPNeeded } from '@labrute/core';
import { Grid, useMediaQuery } from '@mui/material';
import React, { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import BoxBg from '../components/BoxBg';
import BruteComponent from '../components/Brute/Body/BruteComponent';
import Page from '../components/Page';
import StyledButton from '../components/StyledButton';
import Text from '../components/Text';
import { useAlert } from '../hooks/useAlert';
import { useAuth } from '../hooks/useAuth';
import useStateAsync from '../hooks/useStateAsync';
import catchError from '../utils/catchError';
import Server from '../utils/Server';
import VersusMobileView from './mobile/VersusMobileView';

const VersusView = () => {
  const { t } = useTranslation();
  const { bruteName, opponentName } = useParams();
  const navigate = useNavigate();
  const Alert = useAlert();
  const { user } = useAuth();
  const smallScreen = useMediaQuery('(max-width: 935px)');

  // Prevent multi click
  const [fighting, setFighting] = React.useState(false);

  const bruteProps = useMemo(() => ({ name: bruteName || '', include: { body: true, colors: true } }), [bruteName]);
  const { data: _brute } = useStateAsync(null, Server.Brute.get, bruteProps);
  const opponentProps = useMemo(() => ({ name: opponentName || '', include: { body: true, colors: true } }), [opponentName]);
  const { data: _opponent } = useStateAsync(null, Server.Brute.get, opponentProps);

  const brute = _brute as BruteWithBodyColors;
  const opponent = _opponent as BruteWithBodyColors;

  const xpNeededForNextLevel = useMemo(() => brute
  && getXPNeeded(brute.level + 1), [brute]);

  // Redirect if invalid params
  useEffect(() => {
    if (!brute || !opponent || !user) {
      return;
    }
    if (brute.userId !== user.id) {
      navigate(`/${brute.name}/cell`);
    }
    if (opponent.name === brute.name) {
      navigate(`/${brute.name}/arena`);
    }

    if (xpNeededForNextLevel && brute.xp >= xpNeededForNextLevel) {
      navigate(`/${brute.name}/cell`);
    }
  }, [brute, navigate, opponent, user, xpNeededForNextLevel]);

  // Start fight
  const startFight = useCallback(async () => {
    if (!brute || !opponent || fighting) {
      return;
    }

    setFighting(true);

    // Create the fight
    const fight = await Server.Fight.create(brute.name, opponent.name)
      .catch(catchError(Alert));

    if (fight) {
      navigate(`/${brute.name}/fight/${fight.id}`);
    }

    setFighting(false);
  }, [Alert, brute, fighting, navigate, opponent]);

  if (brute && opponent && smallScreen) {
    return <VersusMobileView brute={brute} opponent={opponent} startFight={startFight} />;
  }

  return brute && opponent && (
    <Page title={`${brute.name || ''} ${t('MyBrute')}`} headerUrl={`/${brute.name}/cell`}>
      <BoxBg
        src="/images/versus/background.gif"
        sx={{
          width: 881,
          maxWidth: 1,
          height: 504,
          mx: 'auto',
          pt: 1.5,
          textAlign: 'center',
        }}
      >
        <Text h2 smallCaps bold color="text.primary">{t('dareChallenge')} {opponent.name} !</Text>
        <Grid container spacing={2} sx={{ mt: 4, mb: 5 }}>
          <Grid item xs={12} sm={4}>
            <BruteComponent
              brute={brute}
              sx={{ maxWidth: 200 }}
              inverted
            />
            <Text h3 smallCaps bold color="text.primary">{brute.name}</Text>
            <Text h5 upperCase bold color="secondary">{t('level')} {brute.level}</Text>
          </Grid>
          <Grid item xs={4} sx={{ display: { xs: 'none', sm: 'block' } }} />
          <Grid item xs={12} sm={4}>
            <BruteComponent
              brute={opponent}
              sx={{ maxWidth: 200 }}
            />
            <Text h3 smallCaps bold color="text.primary">{opponent.name}</Text>
            <Text h5 upperCase bold color="secondary">{t('level')} {opponent.level}</Text>
          </Grid>
        </Grid>
        <StyledButton onClick={startFight} sx={{ ml: '39.8%' }}>
          <Text h5 typo="handwritten" upperCase bold color="secondary">{t('startFight')}</Text>
        </StyledButton>
      </BoxBg>
    </Page>
  );
};

export default VersusView;
