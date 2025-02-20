import { BruteRanking, BruteRankings, BruteWithBodyColors } from '@labrute/core';
import { Box, Grid, Link, Paper, Table, TableBody, TableCell, TableHead, TableRow, Tooltip, useMediaQuery, useTheme } from '@mui/material';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { Link as RouterLink } from 'react-router-dom';
import BrutePortrait from '../components/Brute/Body/BrutePortait';
import Page from '../components/Page';
import StyledButton from '../components/StyledButton';
import Text from '../components/Text';
import useStateAsync from '../hooks/useStateAsync';
import Server from '../utils/Server';

const RankingView = () => {
  const { t } = useTranslation();
  const { bruteName, rank } = useParams();
  const theme = useTheme();
  const isMd = useMediaQuery(theme.breakpoints.down('md'));

  const ranking = useMemo(() => (typeof rank === 'undefined' ? undefined : +rank), [rank]);

  const rankingProps = useMemo(() => ({
    name: bruteName || '',
    rank: ranking,
  }), [bruteName, ranking]);
  const { data: rankings } = useStateAsync(null, Server.Brute.getForRank, rankingProps);

  const rankingSelected = useMemo(() => (typeof ranking !== 'undefined'
    ? ranking
    : (rankings && rankings.topBrutes.length
      ? rankings.topBrutes[0].ranking
      : undefined)), [ranking, rankings]);

  const bruteRow = (brute: BruteWithBodyColors, index: number) => (
    <TableRow
      key={brute.id}
    >
      <TableCell component="th" scope="row">
        {index + 1}
      </TableCell>
      <TableCell>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <BrutePortrait brute={brute} shadow={false} sx={{ width: 40, mr: 1, filter: null, }} />
          <Link component={RouterLink} to={`/${brute.name}/cell`}>
            <Text bold>{brute.name}</Text>
          </Link>
        </Box>
      </TableCell>
      <TableCell align="right">{t('level')} {brute.level}</TableCell>
    </TableRow>
  );

  return rankings && (
    <Page title={`${bruteName || ''} ${t('MyBrute')}`} headerUrl={`/${bruteName || ''}/cell`}>
      <Paper sx={{ mx: 4 }}>
        <Text h3 bold upperCase typo="handwritten" sx={{ mr: 2 }}>{t('ranking')} {t(`lvl_${(rankings.topBrutes.length ? rankings.topBrutes[0].ranking : ranking) as BruteRanking}`)}</Text>
      </Paper>
      <Paper sx={{ bgcolor: 'background.paperLight', mt: -2 }}>
        <Box sx={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
        >
          {BruteRankings.map((bruteRanking) => (
            <Tooltip key={bruteRanking} title={t(`lvl_${bruteRanking}`)}>
              <RouterLink to={`/${bruteName || ''}/ranking/${bruteRanking}`}>
                <StyledButton
                  image={rankingSelected === bruteRanking ? '/images/rankings/button_selected.gif' : '/images/rankings/button.gif'}
                  imageHover={rankingSelected === bruteRanking ? '/images/rankings/button_selected.gif' : '/images/rankings/button_hover.gif'}
                  shadow={false}
                  contrast={false}
                  sx={{
                    height: 65,
                    width: 65,
                  }}
                >
                  <Box
                    component="img"
                    src={`/images/rankings/lvl_${bruteRanking}.png`}
                    sx={{ height: 38, width: 38 }}
                  />
                </StyledButton>
              </RouterLink>
            </Tooltip>
          ))}
        </Box>
        <Grid container spacing={1} sx={{ mt: 2 }}>
          <Grid item xs={12} md={3} />
          <Grid item xs={12} md={6}>
            <Table sx={{
              maxWidth: 1,
              '& th': {
                bgcolor: 'secondary.main',
                color: 'secondary.contrastText',
                py: 0.5,
                px: 1,
                fontWeight: 'bold',
                border: '1px solid',
                borderColor: 'background.default',
              },
              '& td': {
                bgcolor: 'background.paperDark',
                py: 0.5,
                px: 1,
                border: '1px solid',
                borderColor: 'background.default',
              },
            }}
            >
              <TableHead>
                <TableRow>
                  <TableCell />
                  <TableCell>{t('brute')}</TableCell>
                  <TableCell align="right">{t('experience')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rankings.topBrutes.map((brute, index) => bruteRow(brute, index))}
                {!!rankings.nearbyBrutes.length && (
                  <>
                    {rankings.position > 18 && (
                      <TableRow>
                        <TableCell component="th" scope="row" colSpan={3}>
                          ...
                        </TableCell>
                      </TableRow>
                    )}
                    {rankings.nearbyBrutes.map(
                      (brute, index) => bruteRow(brute, rankings.position - 3 + index),
                    )}
                  </>
                )}
              </TableBody>
            </Table>
          </Grid>
          {!isMd && (
            <Grid item xs={12} md={3} sx={{ display: 'flex', alignItems: 'center' }}>
              <Box component="img" src="/images/arena/referee.gif" sx={{ maxWidth: 1 }} />
            </Grid>
          )}
        </Grid>
      </Paper>
    </Page>
  );
};

export default RankingView;
