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

import { useQuery } from '@apollo/react-hooks'
import { gql } from 'apollo-boost'
import { GroupEstimatedAPY } from './schema'
import AddressCell from './address-cell'
import Typography from '@material-ui/core/Typography'
import GroupCell from './group-cell'
import Tooltip from '@material-ui/core/Tooltip'
import LinkText from './link-text'

const qEstimatedAPYs = gql`
  query estimatedAPYs($epochLookback: Int!) {
    estimatedAPYs(epochLookback: $epochLookback) {
      group {
        name
        address
        domain
      }
      epochN
      isElected
      estimatedAPY
    }
    targetAPY
    currentEpoch
  }
`;

export default function Scores(props: {}) {
  const urlParams = new URLSearchParams(location.search);
  const [ epochLookback, setEpochLookback ] = useState(Number.parseInt(urlParams.get("lookback") || "0"))
  const { loading, data, error } = useQuery(qEstimatedAPYs, {
    variables: {epochLookback: epochLookback},
  })
  let rows: JSX.Element[] = []
  let targetAPY = "..."
  let epochsTotal = "..."
  if (data) {
    targetAPY = data.targetAPY.toFixed(2) + "%"
    epochsTotal = (data.currentEpoch - 1).toFixed(0)

    const estimatedAPYs: GroupEstimatedAPY[] = data.estimatedAPYs
    estimatedAPYs.sort((a, b) => {
      if (a.isElected !== b.isElected) {
        return b.isElected ? 1 : -1
      }
      const apyDelta = Math.round(b.estimatedAPY * 100) - Math.round(a.estimatedAPY * 100)
      if (Math.abs(apyDelta) > 0) {
        return apyDelta
      }
      if (a.epochN !== b.epochN) {
        return b.epochN - a.epochN
      }
      const nameScoreA = (a.group.name.length > 0) ? 0 : 1
      const nameScoreB = (b.group.name.length > 0) ? 0 : 1
      if (nameScoreA !== nameScoreB) {
        return nameScoreA - nameScoreB
      }

      const domainScoreA = (a.group.domain && a.group.domain?.length > 0) ? 0 : 1
      const domainScoreB = (b.group.domain && b.group.domain?.length > 0) ? 0 : 1
      if (domainScoreA !== domainScoreB) {
        return domainScoreA - domainScoreB
      }
      return (a.group.name.toLowerCase() < b.group.name.toLowerCase()) ? -1 : 1
    })
    const maxEpochs = Math.max(...estimatedAPYs.map((v) => v.epochN))
    rows = estimatedAPYs.map((v) => (
      <TableRow key={v.group.address}>
        <TableCell size="small"><GroupCell group={v.group}/></TableCell>
        <TableCell size="small"><AddressCell address={v.group.address}/></TableCell>
        <TableCell size="small" align="right">
          <span style={{color: v.isElected ? green[500] : red[500]}}>
            {v.isElected ? "YES" : "NO"}
          </span>
        </TableCell>
        <TableCell size="small" align="right" style={{whiteSpace: "nowrap"}}>
          <span style={{color: (v.epochN === maxEpochs) ? green[500] : orange[500]}}>
            {v.epochN} / {maxEpochs}
          </span>
        </TableCell>
        <TableCell size="small" align="right">
          <span style={{
            color: (v.isElected &&
                    (Number.parseFloat(estimatedAPYs[0].estimatedAPY.toFixed(2)) * 0.99 <=
                     Number.parseFloat(v.estimatedAPY.toFixed(2)))) ? green[500] : "",
            }}>
            {v.estimatedAPY.toFixed(2)}%
          </span>
        </TableCell>
      </TableRow>
    ))
  }
  return (
    <Container maxWidth="md">
      <Logo />
      <Typography variant="subtitle2" color="textSecondary" gutterBottom>
        <p>
          Estimated APY (annual percentage yield) is an estimate of expected compounded returns when voting for a specific Group.
          Estimate is based on the past performance of the validators and on the target APY. Target APY is calculated
          using <LinkText
            href="https://github.com/celo-org/celo-proposals/blob/master/CGPs/0002.md"
            text={<code>EpochRewards.targetVotingYield</code>} /> parameter of the network and
          current <LinkText
            href="https://docs.celo.org/celo-codebase/protocol/proof-of-stake/epoch-rewards#adjusting-rewards-for-target-schedule"
            text="rewards multiplier" />.
        </p>
        <p>
          Note that estimated APY is calculated based on all validators that are current members of the group, including ones that
          may not be currently elected. However, each validator is included in calculation only for epochs were it was elected and
          had an actual epoch uptime score. Estimated APY does take Group&apos;s current slashing multiplier into account.
        </p>
        <p>
          As of 2021/05/09, estimated APY calculation takes <LinkText
            href="https://github.com/celo-org/celo-proposals/blob/master/CIPs/cip-0029.md"
            text="CIP-29" /> into account when calcuating uptime scores.
        </p>
      </Typography>

      <div style={{display: "flex", flexDirection: "row", alignItems: "center", marginTop: 20}}>
        <Typography variant="body1">Epochs: {epochsTotal}</Typography>
        <Typography variant="body1" style={{marginLeft: 20}}>Lookback: {epochLookback === 0 ? "MAX" : epochLookback}</Typography>
        <Typography variant="body1" style={{marginLeft: 20}}>Target APY (annual percentage yield): {targetAPY}</Typography>
      </div>
      { error ? <Alert severity="error">{error.message}</Alert>
        : (loading ? <LinearProgress color="primary" /> : (
        <Table aria-label="estimated APYs">
          <TableHead>
            <TableRow>
              <TableCell size="small">name</TableCell>
              <TableCell size="small">address</TableCell>
              <TableCell size="small" align="right">
                <Tooltip title="Groups election status for current epoch">
                  <span>elected</span>
                </Tooltip>
              </TableCell>
              <TableCell size="small" align="right">
                <Tooltip title="Number of epochs that a member of this group was elected in">
                  <span>epochs</span>
                </Tooltip>
              </TableCell>
              <TableCell size="small" align="right">estimated APY</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>{rows}</TableBody>
        </Table>
        ))
      }
    </Container>
  )
}