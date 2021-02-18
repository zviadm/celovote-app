import Box from '@material-ui/core/Box';
import Container from '@material-ui/core/Container';
import Snackbar from '@material-ui/core/Snackbar';
import Alert from '@material-ui/lab/Alert';
import React, { useState } from 'react'
import Logo from './logo';

import { RewardsView } from './rewards'

export default function RewardsOnly(props: {}) {
  const [ error, setError ] = useState<Error | undefined>()
  const urlParams = new URLSearchParams(location.search);
  const addresses: string[] = urlParams.get("addresses")?.split(",") || []

  return (
    <Container maxWidth="md">
      <Logo />
      <Box py={4}>
        <RewardsView
          addressesAll={addresses.map((a) => ({address: a}))}
          persistSelects={false}
          showLockedGold={false}
          showHelp={true}
          onError={setError}
        />
      </Box>
      <Snackbar
        open={error ? true : false}
        autoHideDuration={10000}
        onClose={() => { setError(undefined) }}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}>
        <Alert
          style={{maxWidth: 1000}}
          severity="error"
          onClose={() => { setError(undefined) }}>{error?.message}</Alert>
      </Snackbar>
    </Container>
  )
}