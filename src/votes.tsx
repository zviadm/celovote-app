import React from 'react'
import Table from '@material-ui/core/Table';
import TableRow from '@material-ui/core/TableRow';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableBody from '@material-ui/core/TableBody';
import LinearProgress from '@material-ui/core/LinearProgress';
import Link from '@material-ui/core/Link';
import AddressCell from './address-cell';
import GroupCell from './group-cell';

import { useQuery } from "@apollo/react-hooks";
import { gql, NetworkStatus } from "apollo-boost";
import { QueryResult } from '@apollo/react-common';

import { AddressVotes, Group, GroupEstimatedAPY } from './schema';

const qEstimatedAPYs = gql`
  query estimatedAPYs($groups: [String!]!) {
    estimatedAPYs(groups: $groups, epochLookback: 0) {
      group {
        address
      }
      estimatedAPY
    }
    targetAPY
  }
`;

export function VotesSummaryTable(props: {
  addresses: {
    address: string
    authorized: boolean
  }[],
  addressVotesHook: QueryResult<any, {addresses: string[]}>,
}) {
  let authorizedVotesActive = 0
  let authorizedVotesPending = 0
  let authorizedLockedGold = 0
  let totalVotesActive = 0
  let totalVotesPending = 0
  let totalLockedGold = 0
  if (props.addressVotesHook.data) {
    const addressVotes: AddressVotes[] = props.addressVotesHook.data.addressVotes
    totalVotesActive = sum(addressVotes.map((a) => sum(a.votes.map((v) => v.active / 1e18))))
    totalVotesPending = sum(addressVotes.map((a) => sum(a.votes.map((v) => v.pending / 1e18))))
    totalLockedGold = sum(addressVotes.map((a) => a.lockedGold / 1e18))

    const isAuthorized = new Map(props.addresses.map((a) => [a.address, a.authorized]))
    const authorizedVotes = addressVotes.filter((a) => isAuthorized.get(a.address))
    authorizedVotesActive = sum(authorizedVotes.map((a) => sum(a.votes.map((v) => v.active / 1e18))))
    authorizedVotesPending = sum(authorizedVotes.map((a) => sum(a.votes.map((v) => v.pending / 1e18))))
    authorizedLockedGold = sum(authorizedVotes.map((a) => a.lockedGold / 1e18))
  }
  return (
    <Table aria-label="vote summary" style={{width: 0}}>
      <TableHead>
        <TableRow>
          <TableCell size="small" />
          <TableCell size="small" align="right" style={{whiteSpace: "nowrap"}}>Managed by Celovote</TableCell>
          <TableCell size="small" align="right" style={{whiteSpace: "nowrap"}}>Total</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        <TableRow>
          <TableCell size="small" style={{whiteSpace: "nowrap"}}>Locked CELO</TableCell>
          <TableCell size="small" align="right">{authorizedLockedGold.toFixed(2)}</TableCell>
          <TableCell size="small" align="right">{totalLockedGold.toFixed(2)}</TableCell>
        </TableRow>
        <TableRow>
          <TableCell size="small" style={{whiteSpace: "nowrap"}}>Votes (Active)</TableCell>
          <TableCell size="small" align="right">{authorizedVotesActive.toFixed(2)}</TableCell>
          <TableCell size="small" align="right">{totalVotesActive.toFixed(2)}</TableCell>
        </TableRow>
        <TableRow>
          <TableCell size="small" style={{whiteSpace: "nowrap"}}>Votes (Pending)</TableCell>
          <TableCell size="small" align="right">{authorizedVotesPending.toFixed(2)}</TableCell>
          <TableCell size="small" align="right">{totalVotesPending.toFixed(2)}</TableCell>
        </TableRow>
        <TableRow>
          <TableCell size="small" style={{whiteSpace: "nowrap"}}>Non Voting</TableCell>
          <TableCell size="small" align="right">{Math.max(authorizedLockedGold - authorizedVotesActive - authorizedVotesPending, 0).toFixed(2)}</TableCell>
          <TableCell size="small" align="right">{Math.max(totalLockedGold - totalVotesActive - totalVotesPending, 0).toFixed(2)}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}

export function VotesTable(props: {
  addresses: {
    address: string
    authorized: boolean
  }[],
  addressVotesHook: QueryResult<any, {addresses: string[]}>,
  onError: (error: Error) => void,
}) {
  let fetchAPYs: string[] = []
  if (props.addressVotesHook.data) {
    const addressVotes: AddressVotes[] = props.addressVotesHook.data.addressVotes
    fetchAPYs = ([] as string[]).concat(...addressVotes.map((a) => a.votes.map((v) => v.group.address)))
  }
  const estimatedAPYsHook = useQuery(qEstimatedAPYs, {
    variables: {groups: fetchAPYs},
    skip: fetchAPYs.length === 0,
    onError: props.onError,
  })

  let rows: JSX.Element[] = []
  if (props.addressVotesHook.data) {
    const addressVotes: AddressVotes[] = props.addressVotesHook.data.addressVotes
    const votesByGroup = new Map<string, {active: number, pending: number}>()
    const groups = new Map<string, Group>()
    for (const votes of addressVotes) {
      for (const vote of votes.votes) {
        groups.set(vote.group.address, vote.group)
        let current = votesByGroup.get(vote.group.address)
        if (!current) {
          current = {active: 0, pending: 0}
          votesByGroup.set(vote.group.address, current)
        }
        current.active += vote.active / 1e18
        current.pending += vote.pending / 1e18
      }
    }
    const votesList = Array.from(votesByGroup.entries())
    votesList.sort((a, b) => (b[1].active + b[1].pending) - (a[1].active + a[1].pending))

    let estimatedAPY = new Map<string, string>()
    if (estimatedAPYsHook.data) {
      const apys: GroupEstimatedAPY[] = estimatedAPYsHook.data.estimatedAPYs
      estimatedAPY = new Map(apys.map((v) => [v.group.address, v.estimatedAPY.toFixed(2) + "%"]))
    }
    rows = votesList.map(([addr, votes]) => (
      <TableRow key={addr}>
        <TableCell size="small"><GroupCell group={groups.get(addr)!}/></TableCell>
        <TableCell size="small"><AddressCell address={addr} short /></TableCell>
        <TableCell size="small" align="right">{votes.active.toFixed(2)}</TableCell>
        <TableCell size="small" align="right">{votes.pending.toFixed(2)}</TableCell>
        <TableCell size="small" align="right">{estimatedAPY.get(addr)}</TableCell>
      </TableRow>
    ))
  }
  return (
    <div>
      <Table aria-label="votes">
        <TableHead>
          <TableRow>
            <TableCell size="small">name</TableCell>
            <TableCell size="small">address</TableCell>
            <TableCell size="small" align="right">votes (active)</TableCell>
            <TableCell size="small" align="right">votes (pending)</TableCell>
            <TableCell size="small" align="right">
              <Link target="_blank" href={`/scores`}>estimated APY</Link>
            </TableCell>
          </TableRow>
          {(props.addressVotesHook.networkStatus === NetworkStatus.loading ||
            props.addressVotesHook.networkStatus === NetworkStatus.refetch ||
            estimatedAPYsHook.networkStatus === NetworkStatus.loading) &&
          <TableRow><TableCell size="small" colSpan={5}><LinearProgress color="primary" /></TableCell></TableRow>}
        </TableHead>
        <TableBody>
          {rows}
        </TableBody>
      </Table>
    </div>
  )
}

function sum(a: number[]): number {
  return a.reduce((s, v) => (s+v), 0)
}