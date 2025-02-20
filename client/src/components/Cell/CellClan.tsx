import { BruteWithClan } from '@labrute/core';
import React from 'react';
import { useTranslation } from 'react-i18next';
import StyledButton, { StyledButtonProps } from '../StyledButton';

export interface CellClanProps extends Omit<StyledButtonProps, 'ref'> {
  brute: BruteWithClan;
}

const CellClan = ({
  brute,
  sx,
  ...rest
}: CellClanProps) => {
  const { t } = useTranslation();

  return brute.clan ? (
    <StyledButton
      image="/images/button.gif"
      imageHover="/images/button-hover.gif"
      shadow={false}
      contrast={false}
      sx={{
        fontVariant: 'small-caps',
        m: '0 auto',
        mt: 2,
        height: 56,
        width: 246,
        ...sx
      }}
      {...rest}
    >
      {t('clan')} {brute.clan.name}
    </StyledButton>
  ) : null;
};

export default CellClan;
