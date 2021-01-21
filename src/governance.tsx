import React, { useState, useCallback, useEffect } from 'react'
import Button from '@material-ui/core/Button'
import LinearProgress from '@material-ui/core/LinearProgress'
import Typography from '@material-ui/core/Typography'
import Dialog from '@material-ui/core/Dialog'
import DialogContent from '@material-ui/core/DialogContent'
import DialogTitle from '@material-ui/core/DialogTitle'
import Alert from '@material-ui/lab/Alert'
import Select from '@material-ui/core/Select'
import CircularProgress from '@material-ui/core/CircularProgress'
import Table from '@material-ui/core/Table'
import TableHead from '@material-ui/core/TableHead'
import TableRow from '@material-ui/core/TableRow'
import TableCell from '@material-ui/core/TableCell'
import TableBody from '@material-ui/core/TableBody'
import AddressCell from './address-cell'
import Link from '@material-ui/core/Link'
import Box from '@material-ui/core/Box'
import UnlockLedgerInfo from './unlock-ledger-info'

import { WalletAddress, celoPathIdx, LedgerKit, useLedgerKit } from './ledger'
import { EIP712TypedData, EIP712Object } from '@celo/utils/lib/sign-typed-data-utils'
import { ProxyGovernanceMessage, Address, ProxyGovernanceAction, GovernanceProposals, IsDev, QueuedProposal, VotingProposal } from './schema'
import { gql, NetworkStatus } from 'apollo-boost'
import { useMutation, useQuery } from '@apollo/react-hooks'
import { QueryResult } from '@apollo/react-common';
import LinkText from './link-text'

const mProxyGovernance = gql`
  mutation proxyGovernance(
    $from: String!,
    $typedDataJSON: String!,
    $typedDataSignature: String!) {
    proxyGovernance(
      from: $from,
      typedDataJSON: $typedDataJSON,
      typedDataSignature: $typedDataSignature)
  }
`

interface AuthorizedAccount {
  address: string,
  addressIdx: number,
  rgContract: string,
}

const qGovernanceProposals = gql`
  query governanceProposals {
    governanceProposals {
      queued {
        upvotes
        proposal {
          id
          proposer
          descriptionURL
        }
      }
      voting {
        proposal {
          id
          proposer
          descriptionURL
        }
        votes {
          yes
          no
          abstain
        }
      }
    }
  }
`

export default function GovernanceTab(props: {
  wallets: WalletAddress[],
  addressesHook: QueryResult<any, {addresses: string[]}>,
  onError: (error: Error) => void
}) {
  const proposalsHook = useQuery(qGovernanceProposals, {onError: props.onError, notifyOnNetworkStatusChange: true})
  const [ sendProxyGovernance ] = useMutation(mProxyGovernance)
  const [ progressMessage, setProgressMessage ] = useState("")
  const [ progressIdx, setProgressIdx ] = useState(0)
  const [ progressTotal, setProgressTotal ] = useState(0)

  const process = useCallback((async (
    kit: LedgerKit,
    args: {
      accounts: AuthorizedAccount[],
      proposalId: number,
      action: ProxyGovernanceAction}) => {
    const send = (from: string, message: string, signature: string) => {
      return sendProxyGovernance({variables: {
          from: from,
          typedDataJSON: message,
          typedDataSignature: signature,
      }})
    }
    let idx = 0
    for (const account of args.accounts) {
      idx += 1
      setProgressIdx(idx)
      await performGovernanceAction(
        kit, account, args.proposalId, args.action, send, setProgressMessage)
    }
  }), [sendProxyGovernance])
  const { isOnGoing, onGoingConnected, initOnGoing, cancelOnGoing } = useLedgerKit(process, props.onError)
  const [ refreshedAfterOnGoing, setRefreshedAfterOnGoing ] = useState(true)
  useEffect(() => {
    if (isOnGoing && refreshedAfterOnGoing) {
      setRefreshedAfterOnGoing(false)
    } else if (!isOnGoing && !refreshedAfterOnGoing)  {
      proposalsHook.refetch()
      setRefreshedAfterOnGoing(true)
    }
  }, [isOnGoing, refreshedAfterOnGoing, proposalsHook])


  const [ upvoteProposalId, setUpvoteProposalId ] = useState<number | "">("")
  const [ voteProposalId, setVoteProposalId ] = useState<number | "">("")

  let authorizedLockedGold = 0
  const authorizedAccounts: AuthorizedAccount[] = []
  const addressIdxs = new Map(props.wallets.map((w) => [w.address, celoPathIdx(w.path)]))
  if (props.addressesHook.data) {
    const addresses: Address[] = props.addressesHook.data.addresses
    for (const a of addresses) {
      const idx = addressIdxs.get(a.address)
      if (idx === undefined) {
        continue
      }
      if (a.authorized) {
        authorizedAccounts.push({address: a.address, addressIdx: idx, rgContract: ""})
        authorizedLockedGold += a.lockedGold
      }
      for (const rg of a.rgContracts) {
        if (rg.authorized) {
          authorizedAccounts.push({address: a.address, addressIdx: idx, rgContract: rg.address})
          authorizedLockedGold += rg.lockedGold
        }
      }
    }
  }
  authorizedAccounts.sort((a, b) => a.rgContract.length - b.rgContract.length)

  const proposals: GovernanceProposals = (proposalsHook.data) ? proposalsHook.data.governanceProposals : {queued: [], voting: []}
  const upvoteOptions = proposals.queued.map((p) => (
    <option key={p.proposal.id} value={p.proposal.id}>{p.proposal.id}</option>
  ))
  const voteOptions = proposals.voting.map((p) => (
    <option key={p.proposal.id} value={p.proposal.id}>{p.proposal.id}</option>
  ))

  const isReady = (proposalsHook.data && !props.addressesHook.loading)
  const actionsDisabled = isOnGoing ? true : authorizedAccounts.length === 0
  const authorizedIdxs = Array.from(new Set(authorizedAccounts.map((a) => a.addressIdx)))
  const action = (proposalId: number, action: ProxyGovernanceAction) => {
    const kit = LedgerKit.init(authorizedIdxs)
    setProgressMessage("")
    setProgressIdx(0)
    setProgressTotal(authorizedAccounts.length)
    if (IsDev() && action === "vote-abstain") {
      // HAX: reverse order of accounts in testing to test out behaviour of ProxyGovernance
      // in dev mode too.
      authorizedAccounts.reverse()
    }
    initOnGoing(kit, {accounts: authorizedAccounts, proposalId: proposalId, action: action})
  }

  return (
    <div>
      {(props.addressesHook.networkStatus === NetworkStatus.loading || props.addressesHook.networkStatus === NetworkStatus.refetch ||
        proposalsHook.networkStatus === NetworkStatus.loading || proposalsHook.networkStatus === NetworkStatus.refetch) &&
      <LinearProgress color="primary" />}
      {isReady &&
      <div>
        <Box p={2}>
          <Alert severity="info">
            You can use <LinkText text="celo.stake.id" href="https://celo.stake.id" /> to view more in-depth information
            about all past and currently active governance proposals.
          </Alert>
        </Box>
        <Box p={2}>
          <Typography variant="body2">
            Authorized accounts: {authorizedAccounts.length}
          </Typography>
          <Typography variant="body2">
            Locked CELO in authorized accounts: {(authorizedLockedGold / 1e18).toFixed(2)}
          </Typography>
          {upvoteOptions.length === 0 && voteOptions.length === 0 &&
          <Typography variant="body2">
            There are no active governance proposals.
          </Typography>}
        </Box>

        {proposals.queued.length > 0 &&
        <Box p={2}>
          <Typography variant="h5" component="h2">
            Queued Proposals
          </Typography>
          <Alert severity="warning" style={{marginTop: 10, marginBottom: 10}}>
            You can upvote only one proposal at a time. You will have to wait until your upvoted proposal is dequeued,
            before you can upvote another queued proposal.
          </Alert>
          <div style={{display: "flex", flexDirection: "row", alignItems: "center", marginTop: 20}}>
            <Select
              native
              value={upvoteProposalId}
              onChange={(e) => { setUpvoteProposalId(e.target.value as number) }}>
              <option value="" disabled>Select Proposal</option>
              {upvoteOptions}
            </Select>
            <Button
              variant="contained"
              style={{marginLeft: 10}}
              disabled={actionsDisabled || upvoteProposalId === ''}
              onClick={() => { action(upvoteProposalId as number, "upvote")}}
              >Upvote</Button>
          </div>
          <ProposalsToUpvote proposals={proposals.queued} />
        </Box>}

        {proposals.voting.length > 0 &&
        <Box p={2}>
          <Typography variant="h5" component="h2">
            Proposals in Referendum
          </Typography>
          <div style={{display: "flex", flexDirection: "row", marginTop: 20}}>
            <Select
              native
              value={voteProposalId}
              onChange={(e) => { setVoteProposalId(e.target.value as number) }}>
              <option value="" disabled>Select Proposal</option>
              {voteOptions}
            </Select>
            <Button
              variant="contained"
              style={{marginLeft: 10}}
              disabled={actionsDisabled || voteProposalId === ''}
              onClick={() => { action(voteProposalId as number, "vote-yes")}}
              >Yes</Button>
            <Button
              variant="contained"
              style={{marginLeft: 10}}
              disabled={actionsDisabled || voteProposalId === ''}
              onClick={() => { action(voteProposalId as number, "vote-no")}}
              >No</Button>
            <Button
              variant="contained"
              style={{marginLeft: 10}}
              disabled={actionsDisabled || voteProposalId === ''}
              onClick={() => { action(voteProposalId as number, "vote-abstain")}}
              >Abstain</Button>
          </div>
          <ProposalsToVote proposals={proposals.voting} />
        </Box>}
      </div>}

      <Dialog
        open={isOnGoing ? true : false}
        onClose={() => {
          if (onGoingConnected) {
            return // Don't allow closing while transactions are in progress.
          }
          cancelOnGoing()
        }}>
        <DialogTitle>Perform Governance action</DialogTitle>
        <DialogContent>
          <UnlockLedgerInfo />
          {!onGoingConnected && <LinearProgress color="secondary" />}
          {onGoingConnected &&
          <div>
            <Typography color="secondary" variant="body2" style={{marginTop: 20}}>
              Processing account {progressIdx} out of {progressTotal}
            </Typography>
            <div style={{display: "flex", flexDirection: "row", alignItems: "center", marginTop: 20}}>
              <Typography color="secondary" variant="body2">
                {progressMessage}
              </Typography>
              <CircularProgress color="secondary" size={20} style={{marginLeft: 10}} />
            </div>
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ProposalsToUpvote(props: {proposals: QueuedProposal[]}) {
  const rows = props.proposals.map((p) => (
    <TableRow key={`upvote-${p.proposal.id}`}>
      <TableCell size="small">
        <Link href={`https://celo.stake.id/#/proposal/${p.proposal.id}`} target="_blank" rel="noreferrer">{p.proposal.id}</Link>
	  </TableCell>
      <TableCell size="small"><AddressCell address={p.proposal.proposer} short /></TableCell>
      <TableCell size="small">
        <Link href={p.proposal.descriptionURL} target="_blank" rel="noreferrer">{p.proposal.descriptionURL}</Link>
      </TableCell>
      <TableCell size="small" align="right">{(p.upvotes / 1e18).toFixed(2)}</TableCell>
    </TableRow>
  ))
  return (
    <div>
      <Table aria-label="vote summary">
        <TableHead>
          <TableRow>
            <TableCell size="small">ID</TableCell>
            <TableCell size="small">Proposer</TableCell>
            <TableCell size="small">Description</TableCell>
            <TableCell size="small" align="right">Upvotes</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>{rows}</TableBody>
      </Table>
    </div>
  )
}

function ProposalsToVote(props: {proposals: VotingProposal[]}) {
  const rows = props.proposals.map((p) => (
    <TableRow key={`vote-${p.proposal.id}`}>
      <TableCell size="small">
        <Link href={`https://celo.stake.id/#/proposal/${p.proposal.id}`} target="_blank" rel="noreferrer">{p.proposal.id}</Link>
	  </TableCell>
      <TableCell size="small"><AddressCell address={p.proposal.proposer} short /></TableCell>
      <TableCell size="small">
        <Link href={p.proposal.descriptionURL} target="_blank" rel="noreferrer">{p.proposal.descriptionURL}</Link>
      </TableCell>
      <TableCell size="small" align="right">{(p.votes.yes / 1e18).toFixed(2)}</TableCell>
      <TableCell size="small" align="right">{(p.votes.no / 1e18).toFixed(2)}</TableCell>
      <TableCell size="small" align="right">{(p.votes.abstain / 1e18).toFixed(2)}</TableCell>
    </TableRow>
  ))
  return (
    <div>
      <Table aria-label="vote summary">
        <TableHead>
          <TableRow>
            <TableCell size="small">ID</TableCell>
            <TableCell size="small">Proposer</TableCell>
            <TableCell size="small">Description</TableCell>
            <TableCell size="small" align="right">YES</TableCell>
            <TableCell size="small" align="right">NO</TableCell>
            <TableCell size="small" align="right">ABSTAIN</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>{rows}</TableBody>
      </Table>
    </div>
  )
}

async function performGovernanceAction(
  kit: LedgerKit,
  account: AuthorizedAccount,
  proposalId: number,
  action: ProxyGovernanceAction,
  send: (from: string, message: string, signature: string) => Promise<any>,
  setProgress: (message: string) => void) {
  if (account.rgContract.length > 0) {
    return proxyGovernanceAction(kit, account, proposalId, action, send, setProgress)
  }
  kit.kit.defaultAccount = account.address
  const governance = await kit.kit.contracts.getGovernance()
  let tx
  switch (action) {
    case "upvote":
      tx = await governance.upvote(proposalId, account.address)
      break
    case "revoke-upvote":
      tx = await governance.revokeUpvote(account.address)
      break
    case "vote-yes":
      tx = await governance.vote(proposalId, "Yes")
      break
    case "vote-no":
      tx = await governance.vote(proposalId, "No")
      break
    case "vote-abstain":
      tx = await governance.vote(proposalId, "Abstain")
      break
    default:
      throw new Error(`ProxyGovernance: unknown action: ${action}`)
  }
  setProgress(`Waiting for approval to "${action}" on proposal ${proposalId} from ${account.address}...`)
  await tx.sendAndWaitForReceipt()
}

async function proxyGovernanceAction(
  kit: LedgerKit,
  account: AuthorizedAccount,
  proposalId: number,
  action: ProxyGovernanceAction,
  send: (from: string, message: string, signature: string) => Promise<any>,
  setProgress: (message: string) => void) {
  kit.kit.defaultAccount = account.address
  const signedAtBlock = await kit.kit.web3.eth.getBlockNumber()
  const networkId = await kit.kit.web3.eth.net.getId()
  const message: ProxyGovernanceMessage = {
    signedAtBlock: signedAtBlock,
    rgContract: account.rgContract,
    proposalId: proposalId,
    action: action,
  }
  const data: EIP712TypedData = {
    domain: {
      name: "celovote.com",
      version: "1",
      chainId: networkId,
    },
    types: {
      EIP712Domain: [
        {name: "name", type: "string"},
        {name: "version", type: "string"},
        {name: "chainId", type: "uint256"},
      ],
      ProxyGovernance: [
        {name: "signedAtBlock", type: "uint64"},
        {name: "rgContract", type: "string"},
        {name: "proposalId", type: "uint64"},
        {name: "action", type: "string"}
      ],
    },
    primaryType: "ProxyGovernance",
    message: message as unknown as EIP712Object,
  }
  setProgress(`Waiting for approval to proxy "${action}" on proposal ${proposalId} for ReleaseGold contract ${account.rgContract}...`)
  const signature = await kit.wallet.signTypedData(account.address, data)
  const encodedData = JSON.stringify(data)
  setProgress(`Proxying "${action}" on proposal ${proposalId} for ReleaseGold contract ${account.rgContract}...`)
  await send(account.address, encodedData, signature)
}
