import React, { useState } from 'react'
import Container from '@material-ui/core/Container'
import Alert from '@material-ui/lab/Alert'
import LinearProgress from '@material-ui/core/LinearProgress'
import Table from '@material-ui/core/Table'
import TableHead from '@material-ui/core/TableHead'
import TableRow from '@material-ui/core/TableRow'
import TableCell from '@material-ui/core/TableCell'
import TableBody from '@material-ui/core/TableBody'
import Logo from './logo'
import green from '@material-ui/core/colors/green';
import red from '@material-ui/core/colors/red';
import orange from '@material-ui/core/colors/orange';

import BigNumber from 'bignumber.js'
import { useQuery } from '@apollo/react-hooks'
import { gql } from 'apollo-boost'
import { GroupEstimatedAPY, SavingsCELOTotalSupply } from './schema'
import AddressCell from './address-cell'
import Typography from '@material-ui/core/Typography'
import GroupCell from './group-cell'
import Tooltip from '@material-ui/core/Tooltip'
import LinkText from './link-text'

const qTotalSupply = gql`
  query savingsCELOTotalSupply {
    savingsCELOTotalSupply {
      celoWEI
      sceloWEI
    }
  }
`;


export default function SavingsCELO(props: {}) {
  const { loading, data, error } = useQuery<{savingsCELOTotalSupply: SavingsCELOTotalSupply}>(qTotalSupply, { pollInterval: 30000 })
  const total_CELO = new BigNumber(data?.savingsCELOTotalSupply.celoWEI || 0)
  const total_sCELO = new BigNumber(data?.savingsCELOTotalSupply.sceloWEI || 0)
  console.info(`data: `, data)
  return (
    <Container maxWidth="md">
      <Typography variant="h4" gutterBottom>
        SavingsCELO
      </Typography>
      {error ?
      <Alert severity="error">{error.message}</Alert> :
      loading ? <LinearProgress color="primary" /> : <>
      <Typography variant="h6" gutterBottom>
        <Typography component="span" color="textSecondary">Current conversion rate:</Typography>
        <br />
        1 CELO = {total_sCELO.div(total_CELO).toFixed(18, BigNumber.ROUND_DOWN)} sCELO
      </Typography>
      <Typography color="textSecondary">
        Conversion rate decreases slightly with every epoch change (i.e. every day), making sCELO
        more valuable as time goes by. <LinkText
          href="https://docs.savingscelo.com"
          text="More details can be found in SavingsCELO wiki."
        />
      </Typography>
      </>}
    </Container>
  )
}