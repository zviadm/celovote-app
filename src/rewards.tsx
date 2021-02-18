import React, { useState, useEffect } from 'react'
import Button from '@material-ui/core/Button'
import { WalletAddress } from './ledger'
import { Address, EpochReward, BaseAddress } from './schema'
import { gql, NetworkStatus } from 'apollo-boost'
import { useLazyQuery } from '@apollo/react-hooks'
import { QueryResult } from '@apollo/react-common';
import LinearProgress from '@material-ui/core/LinearProgress'
import Table from '@material-ui/core/Table'
import TableHead from '@material-ui/core/TableHead'
import TableRow from '@material-ui/core/TableRow'
import TableCell from '@material-ui/core/TableCell'
import TableBody from '@material-ui/core/TableBody'
import AddressCell from './address-cell'
import Checkbox from '@material-ui/core/Checkbox'
import IconButton from '@material-ui/core/IconButton'
import KeyboardArrowDownIcon from '@material-ui/icons/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@material-ui/icons/KeyboardArrowUp';
import HelpOutlineIcon from '@material-ui/icons/HelpOutline';
import Typography from '@material-ui/core/Typography'
import LinkText from './link-text'
import { Collapse } from '@material-ui/core'
import BigNumber from 'bignumber.js'

const qAddressRewards = gql`
  query addressRewards($addresses: [String!]!) {
    addressRewards(addresses: $addresses) {
      timestampMs
      epoch
      asGold
      asUSD
    }
  }
`

const uncheckedKey = "app/rewards/unchecked"
const sectionsOpenKey = "app/rewards/sections-open"

export default function RewardsTab(props: {
  wallets: WalletAddress[],
  addressesHook: QueryResult<any, {addresses: string[]}>,
  onError: (error: Error) => void
}) {
  let addressesAll: BaseAddress[] = []
  if (props.addressesHook.data) {
    const addresses: Address[] = props.addressesHook.data.addresses
    addressesAll = (addresses as BaseAddress[]).concat(...addresses.map((a) => a.rgContracts))
    addressesAll.sort((a, b) => b.lockedGold - a.lockedGold)
  }

  return (
    <div>
      {(props.addressesHook.networkStatus === NetworkStatus.loading || props.addressesHook.networkStatus === NetworkStatus.refetch) &&
      <LinearProgress color="primary" />}
      {addressesAll.length > 0 &&
      <RewardsView
        addressesAll={addressesAll}
        persistSelects={true}
        showLockedGold={true}
        showHelp={false}
        onError={props.onError}
      />}
    </div>
  )
}

export function RewardsView(props: {
  addressesAll: {address: string, lockedGold?: number}[],
  showLockedGold: boolean,
  showHelp: boolean,
  persistSelects: boolean,
  onError: (error: Error) => void
}) {
  const addressesAll = props.addressesAll
  const [ fetchRewards, { called, loading, data } ] = useLazyQuery(
    qAddressRewards,
    {
      onError: props.onError,
      notifyOnNetworkStatusChange: true,
    })
  const [ unchecked, _setUnchecked ] = useState<{[address: string]: boolean | undefined}>({})
  const [ sectionsOpen, _setSectionsOpen ] = useState<{[section: string]: boolean | undefined}>({})
  const persistSelects = props.persistSelects
  useEffect(() => {
    if (!persistSelects) {
      return
    }
    const uncheckedJSON = localStorage.getItem(uncheckedKey)
    if (uncheckedJSON) {
      _setUnchecked(JSON.parse(uncheckedJSON))
    }
    const sectionsOpenJSON = localStorage.getItem(sectionsOpenKey)
    if (sectionsOpenJSON) {
      _setSectionsOpen(JSON.parse(sectionsOpenJSON))
    }
  }, [persistSelects])

  const setUnchecked = (v: {[address: string]: boolean | undefined}) => {
    _setUnchecked(v)
    if (persistSelects) {
      localStorage.setItem(uncheckedKey, JSON.stringify(v))
    }
  }
  const setSectionsOpen = (v: {[section: string]: boolean | undefined}) => {
    _setSectionsOpen(v)
    if (persistSelects) {
      localStorage.setItem(sectionsOpenKey, JSON.stringify(v))
    }
  }

  useEffect(() => {
    if (called || addressesAll.length === 0) {
      return
    }
    const addressesToFetch = addressesAll.filter((a) => !unchecked[a.address]).map((a) => a.address)
    fetchRewards({variables: {addresses: addressesToFetch}})
  }, [called, addressesAll, unchecked, fetchRewards])

  const [ helpOpen, setHelpOpen ] = useState(props.showHelp)

  const rewardsPerQ = new Map<string, EpochReward[]>()
  if (data) {
    const epochRewards: EpochReward[] = data.addressRewards
    epochRewards.map((r) => {
      const date = new Date(r.timestampMs)
      const quarter = Math.floor(date.getMonth() / 3) + 1
      const section = `${date.getFullYear()} Q${quarter}`

      const rewards = rewardsPerQ.get(section)
      if (rewards) {
        rewards.push(r)
      } else {
        rewardsPerQ.set(section, [r])
      }
    })
  }
  const rewardsTotals: [string, {asGold: number, asUSD: number}][] = []
  rewardsPerQ.forEach((rewards, section) => {
    rewards.sort((a, b) => a.epoch - b.epoch)
    const total = rewards.reduce((p, c) => ({
      asGold: p.asGold + c.asGold,
      asUSD: p.asUSD + c.asUSD,
    }), {asGold: 0, asUSD: 0})
    rewardsTotals.push([section, total])
  })
  rewardsTotals.sort((a, b) => a[0] < b[0] ? -1 : 1)

  const rewardsRows = ([] as JSX.Element[]).concat(
    ...rewardsTotals.map(([section, total]) => {
      const open = sectionsOpen[section]
      const mainRow = (
        <TableRow key={`row-${section}`}>
          <TableCell size="small">
            <IconButton
              size="small"
              onClick={ () => { setSectionsOpen({...sectionsOpen, [section]: !open})}}>
              {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
            </IconButton>
          </TableCell>
          <TableCell size="small">{section}</TableCell>
          <TableCell size="small" align="right">{(total.asGold / 1e18).toFixed(4)}</TableCell>
          <TableCell size="small" align="right">{(total.asUSD / 1e18).toFixed(4)}</TableCell>
        </TableRow>)
      if (!open) {
        return [mainRow]
      }
      const epochRows = rewardsPerQ.get(section)!.map((r) => {
        const d = new Date(r.timestampMs)
        const epochDate = `${d.getFullYear()}/` +
          `${(d.getMonth() + 1).toFixed().padStart(2, "0")}/` +
          `${d.getDate().toFixed().padStart(2, "0")}`
        return (
        <TableRow key={`row-${r.epoch}`}>
          <TableCell size="small">Epoch: {r.epoch}</TableCell>
          <TableCell size="small">{epochDate}</TableCell>
          <TableCell size="small" align="right">{(r.asGold / 1e18).toFixed(4)}</TableCell>
          <TableCell size="small" align="right">{(r.asUSD / 1e18).toFixed(4)}</TableCell>
        </TableRow>)
      })
      return [mainRow].concat(epochRows)
  }))

  const addressesToFetch = addressesAll.filter((a) => !unchecked[a.address]).map((a) => a.address)
  return (
    <div>
      <div style={{display: "flex", flexDirection: "row"}}>
        <Table style={{width: 0}}>
          <TableHead>
            <TableRow>
              <TableCell size="small">address</TableCell>
              {props.showLockedGold &&
              <TableCell size="small" align="right" style={{whiteSpace: "nowrap"}}>locked CELO</TableCell>}
              <TableCell size="small"></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {addressesAll.map((a) =>
            <TableRow key={`row-${a.address}`}>
              <TableCell size="small"><AddressCell address={a.address} short /></TableCell>
              {props.showLockedGold &&
              <TableCell size="small" align="right">{((a.lockedGold || 0) / 1e18).toFixed(2)}</TableCell>}
              <TableCell size="small">
                <Checkbox
                  size="small"
                  color="primary"
                  checked={!unchecked[a.address]}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    setUnchecked({...unchecked, [a.address]: !event.target.checked});
                  }}
                />
              </TableCell>
            </TableRow>)}
          </TableBody>
        </Table>
        <div style={{
          marginLeft: 20,
          display: "flex",
          flexDirection: "column",
          flex: 1}}>
          <div style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            }}>
            <Button
              variant="contained" size="small"
              color="primary"
              onClick={ () => { fetchRewards({variables: {addresses: addressesToFetch}}) }}
              disabled={loading || addressesToFetch.length === 0}
            >
              Show Rewards
            </Button>
            <IconButton onClick={() => { setHelpOpen(!helpOpen) }} size="small"><HelpOutlineIcon /></IconButton>
          </div>
          <Collapse in={helpOpen}>
            <ul>
              <li>
                <Typography variant="body2">
                <LinkText
                  href="https://docs.celo.org/celo-codebase/protocol/proof-of-stake/epoch-rewards/locked-gold-rewards"
                  text="Rewards" /> for locked CELO holders are distributed every epoch and they compound automatically.
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                cUSD conversion is provided for accounting purposes only.
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                For distributions that happened before on-chain oracles were enabled, exchange rate of
                1 CELO =&gt; 1 cUSD is used based on CoinList auction price.
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                For other distributions, CELO =&gt; cUSD exchange rate is based on on-chain exchange
                rate when distribution was issued.
                </Typography>
              </li>
            </ul>
          </Collapse>
          {loading && <LinearProgress color="primary" />}
          {rewardsRows.length > 0 &&
          <Table style={{marginTop: 20}}>
            <TableHead>
              <TableRow>
                <TableCell size="small" style={{width: 80}}></TableCell>
                <TableCell size="small" style={{width: 80}}>Date</TableCell>
                <TableCell size="small" align="right">as CELO</TableCell>
                <TableCell size="small" align="right">as cUSD</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rewardsRows}
            </TableBody>
          </Table>
          }
        </div>
      </div>
    </div>
  )
}