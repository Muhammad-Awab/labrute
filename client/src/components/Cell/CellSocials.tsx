import { AccountTree } from '@mui/icons-material';
import { Box, Grid, Paper, PaperProps, Tooltip } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useBrute } from '../../hooks/useBrute';
import useStateAsync from '../../hooks/useStateAsync';
import Server from '../../utils/Server';
import Link from '../Link';
import Text from '../Text';

export interface CellSocialsProps extends PaperProps {
  smallScreen?: boolean;
}

const CellSocials = ({
  smallScreen,
  ...rest
}: CellSocialsProps) => {
  const { brute } = useBrute();
  const { t } = useTranslation();

  const { data: getter } = useStateAsync(null, Server.Brute.getRanking, brute?.name || '');

  return brute && (
    <Paper {...rest}>
      <Grid container spacing={1}>
        <Grid item xs={smallScreen ? 12 : 6}>
          <Tooltip title={`${t('destinyOf')} ${brute.name}`}>
            <Link
              to={`/${brute.name}/destiny`}
              sx={{ mr: 1 }}
            >
              <AccountTree />
            </Link>
          </Tooltip>
          <Text h2 smallCaps sx={{ display: 'inline-block' }}>{brute.name}</Text>
        </Grid>
        <Grid item xs={smallScreen ? 6 : 3}>
          {!!brute.master && (
            <Box>
              <Text bold color="secondary" component="span">{t('master')}: </Text>
              <Text bold component="span"><Link to={`/${brute.master.name}/cell`}>{brute.master.name}</Link></Text>
            </Box>
          )}
          <Box>
            <Link to={`/${brute.name}/ranking`}>
              <Text bold color="secondary" component="span">{t('ranking')}: </Text>
              <Text bold component="span">
                {getter?.ranking || 'NA'}
              </Text>
            </Link>
          </Box>
        </Grid>
        <Grid item xs={smallScreen ? 6 : 3}>
          <Box>
            <Text bold color="secondary" component="span">{t('victories')}: </Text>
            <Text bold component="span">{brute.victories}</Text>
          </Box>
          {!!brute.pupilsCount && (
            <Box>
              <Text bold color="secondary" component="span">{t('pupils')}: </Text>
              <Text bold component="span">{brute.pupilsCount}</Text>
            </Box>
          )}
        </Grid>
      </Grid>
    </Paper>
  );
};

export default CellSocials;
