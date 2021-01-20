import React, { useState, useEffect } from 'react'
import Alert from '@material-ui/lab/Alert';
import Box from '@material-ui/core/Box';
import Snackbar from '@material-ui/core/Snackbar';
import Typography from '@material-ui/core/Typography';
import Link from '@material-ui/core/Link';
import Container from '@material-ui/core/Container';
import Logo from './logo';
import AddWallet from './add'
import WalletTable from './wallets';

import { useQuery } from '@apollo/react-hooks';
import { gql } from 'apollo-boost';

import { WalletAddress, celoPathIdx } from './ledger'
import { BaseAddress, Address } from './schema';
import GovernanceTab from './governance';
import AppBar from '@material-ui/core/AppBar';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import Paper from '@material-ui/core/Paper';
import { VotesTable, VotesSummaryTable } from './votes';
import { useRouteMatch, useHistory } from 'react-router-dom';
import RewardsTab from './rewards';
import LinkText from './link-text';
import TransfersTab from './transfers';

const walletsKey = "app/wallets"

const qAddresses = gql`
  query addresses($addresses: [String!]!) {
    addresses(addresses: $addresses) {
      address
      name
      authorized
      lockedGold
      balanceGold
      totalGold
      rgContracts {
        address
        name
        authorized
        lockedGold
        balanceGold
        totalGold
      }
    }
  }
`;

const qAddressVotes = gql`
  query addressVotes($addresses: [String!]!) {
    addressVotes(addresses: $addresses) {
    address
    lockedGold
      votes {
        group {
          address
          name
          domain
        }
        active
        pending
      }
    }
  }
`;

export default function App(props: {location: string}) {
  const history = useHistory();
  const match = useRouteMatch<{tab?: string}>("/t/:tab");
  const tabIndex = match?.params.tab ? Number.parseInt(match?.params.tab) : 0
  const setTabIndex = (idx: number) => {
    history.push("/t/" + idx)
  }

  const [ wallets, setWallets ] = useState<WalletAddress[]>([])
  const [ error, setError ] = useState<Error | undefined>()
  useEffect(() => {
    const walletsJSON = localStorage.getItem(walletsKey)
    if (walletsJSON) {
      setWallets(JSON.parse(walletsJSON))
    }
  }, [])
  const updateWallets = (ws: WalletAddress[]) => {
    setWallets(ws)
    localStorage.setItem(walletsKey, JSON.stringify(ws))
  }
  const addWallets = (ws: WalletAddress[]) => {
    ws = ws.filter((wallet) => (
      wallets.findIndex((w) => (w.address === wallet.address)) < 0))
    if (ws.length === 0) {
      return
    }
    ws.push(...wallets)
    ws.sort((a, b) => (celoPathIdx(a.path) - celoPathIdx(b.path)))
    updateWallets(ws)
  }
  const removeWallet = (address: string) => {
    const ws = wallets.filter((w) => (w.address !== address))
    updateWallets(ws)
  }

  const addressesHook = useQuery(qAddresses, {
    variables: {addresses: wallets.map((w) => w.address) },
    skip: wallets.length === 0,
    notifyOnNetworkStatusChange: true,
    pollInterval: 300000,
    onError: setError,
  })

  let addressesAll: BaseAddress[] = []
  if (addressesHook.data) {
    const addresses: Address[] = addressesHook.data.addresses
    addressesAll = addressesAll.concat(
      ...(addresses.map((a) => [a, ...a.rgContracts])))
  }
  const addressVotesHook = useQuery(qAddressVotes, {
    variables: {addresses: addressesAll.map((a) => a.address)},
    skip: (addressesAll.length === 0),
    pollInterval: 300000,
    onError: setError,
  })

  return (
    <Container maxWidth="md">
      <Box py={4}>
        <Logo />
        <Typography variant="subtitle1" color="textSecondary" gutterBottom>
          Automatically vote with your CELO to maximize returns and minimize risk.
        </Typography>
        <Typography variant="subtitle2" color="textSecondary" gutterBottom>
          Celovote automatically distributes votes
          to <LinkText href="/faq#how-does-it-vote" text="preferred groups" /> that have
          high <LinkText href="/scores" text="estimated APY" /> (annual percentage yield) and automatically
          rebalances votes if any of the voted groups fails to maintain high uptime. You retain full custody of
          your CELO and receive 100% of your rewards. <Link href="/faq" target="_blank">Learn More!</Link>
        </Typography>
        <Typography variant="subtitle2" color="textSecondary">
          New to owning CELO tokens? Read our
          step-by-step <LinkText href="https://wotrust.us/posts/celovote-guide/" text="guide" /> to get started.
        </Typography>
      </Box>
      <AppBar position="static" color="default">
        <Tabs
          value={tabIndex}
          onChange={(event, value) => setTabIndex(value)}
          indicatorColor="primary"
          centered
          >
          <Tab label="Wallet" />
          <Tab label="Votes" disabled={addressesAll.length === 0} />
          <Tab label="Rewards"  disabled={addressesAll.length === 0} />
          <Tab label="Governance" />
          <Tab label="Transfers & Withdraws" />
        </Tabs>
      </AppBar>
      <Paper>
        {tabIndex === 0 &&
        <div>
          <Box p={2}>
            <AddWallet
              isInitialized={wallets.length > 0}
              onAdd={addWallets}
              onError={setError}
            />
          </Box>
          {wallets.length > 0 &&
          <WalletTable
            wallets={wallets}
            addressesHook={addressesHook}
            onRefresh={() => Promise.all([addressesHook.refetch(), addressVotesHook.refetch()])}
            onRemove={removeWallet}
            onError={setError}
          />}
          {addressesAll.length > 0 &&
          <div style={{marginTop: 20, display: "flex", flexDirection: "row", justifyContent: "flex-end"}}>
            <VotesSummaryTable addresses={addressesAll} addressVotesHook={addressVotesHook} />
          </div>}
        </div>}
        {tabIndex === 1 &&
        <Box p={2}>
          <VotesTable addresses={addressesAll} addressVotesHook={addressVotesHook} onError={setError} />
        </Box>}
        {tabIndex === 2 &&
        <Box p={2}>
          <RewardsTab
            wallets={wallets}
            addressesHook={addressesHook}
            onError={setError}
          />
        </Box>}
        {tabIndex === 3 &&
        <Box p={2}>
          <GovernanceTab
            wallets={wallets}
            addressesHook={addressesHook}
            onError={setError}
          />
        </Box>}
        {tabIndex === 4 &&
        <Box p={2}>
          <TransfersTab
            wallets={wallets}
            addressesHook={addressesHook}
            onError={setError}
          />
        </Box>}
      </Paper>

      <div style={{
        display: "flex",
        flexDirection: "row",
        justifyContent: "flex-end",
        }}>
        <Box p={2}>
          <Typography variant="subtitle2" color="textSecondary" gutterBottom>
            Report issues or bugs:<br />
            <LinkText href="mailto:support@celovote.com" text="support@celovote.com" />
          </Typography>
        </Box>
      </div>
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

