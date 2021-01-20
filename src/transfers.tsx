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
import Box from '@material-ui/core/Box'
import UnlockLedgerInfo from './unlock-ledger-info'
import TextField from '@material-ui/core/TextField'

import { WalletAddress, celoPathIdx, LedgerKit, useLedgerKit } from './ledger'
import { Address, celoURI, BaseAddress } from './schema'
import { NetworkStatus } from 'apollo-boost'
import { QueryResult } from '@apollo/react-common';
import { newKit, ContractKit } from '@celo/contractkit'
import { ReleaseGoldWrapper } from '@celo/contractkit/lib/wrappers/ReleaseGold'
import { newReleaseGold } from '@celo/contractkit/lib/generated/ReleaseGold'
import { BigNumber } from 'bignumber.js'
import { LockedGoldWrapper } from '@celo/contractkit/lib/wrappers/LockedGold'
import { AccountsWrapper } from '@celo/contractkit/lib/wrappers/Accounts'

export default function TransfersTab(props: {
  wallets: WalletAddress[],
  addressesHook: QueryResult<any, {addresses: string[]}>,
  onError: (error: Error) => void
}) {
  const addresses: Address[] | undefined = props.addressesHook.data?.addresses
  const [ rgData, setRGData ] = useState<{
    contract: BaseAddress,
    available: BigNumber,
    unlocked: BigNumber,
    pending: BigNumber}[]>([])
  const [ rgSelected, setRGSelected ] = useState<string>("")
  const [ toWithdraw, setToWithdraw ] = useState("0")

  const [ addrData, setAddrData ] = useState<{
    address: Address,
    available: BigNumber,
    pending: BigNumber}[]>([])
  const [ addrSelected, setAddrSelected ] = useState<string>("")
  const [ toTransfer, setToTransfer ] = useState("0")
  const [ toAddr, setToAddr] = useState("")

  const [ needsRefresh, setNeedsRefresh ] = useState<boolean | undefined>(undefined)
  useEffect(() => { setNeedsRefresh(true) }, [addresses])
  const onError = props.onError
  useEffect(() => {
    if (needsRefresh === undefined) {
      return
    }
    if (!addresses) {
      setNeedsRefresh(undefined)
      return
    }
    (async (addresses: Address[]) => {
      const kit = await newKit(celoURI)
      try {
        const celoNow = (await kit.web3.eth.getBlock("latest")).timestamp as number
        const accounts = await kit.contracts.getAccounts()
        const goldToken = await kit.contracts.getGoldToken()
        const lockedGold = await kit.contracts.getLockedGold()
        const rgDataNew = []
        const rgContracts = ([] as BaseAddress[]).concat(...addresses.map((a) => a.rgContracts))
        for (const rgContract of rgContracts) {
          const rg = new ReleaseGoldWrapper(kit, newReleaseGold(kit.web3, rgContract.address))
          const releasedTotal = await rg.getCurrentReleasedTotalAmount()
          const totalWithdrawn = await rg.getTotalWithdrawn()
          const maxDistribution = await rg.getMaxDistribution()
          const available = BigNumber.minimum(releasedTotal.minus(totalWithdrawn), maxDistribution.minus(totalWithdrawn)).div(1e18)
          const unlocked = (await rg.getRemainingUnlockedBalance()).div(1e18)
          const { ready, pending } = await checkPendingLockedGold(accounts, lockedGold, rgContract.address, celoNow)
          rgDataNew.push({
            contract: rgContract,
            available,
            unlocked: unlocked.plus(ready),
            pending})
        }

        const addrDataNew = []
        for (const addr of addresses) {
          const balance = (await goldToken.balanceOf(addr.address)).div(1e18)
          const { ready, pending } = await checkPendingLockedGold(accounts, lockedGold, addr.address, celoNow)
          addrDataNew.push({
            address: addr,
            available: balance.plus(ready),
            pending,
          })
        }

        setRGData(rgDataNew)
        setAddrData(addrDataNew)
      } finally {
        kit.stop()
      }
    })(addresses)
    .catch(onError)
    .finally(() => { setNeedsRefresh(undefined) })
  }, [addresses, needsRefresh, onError])

  const [ progressMessage, setProgressMessage ] = useState("")
  const processTransfer = useCallback((async (
    kit: LedgerKit,
    args: {
      type: "withdraw" | "transfer",
      from: string,
      amount: number,
      to?: string}) => {
    try {
      const amt = new BigNumber(args.amount).multipliedBy(1e18)
      const celoNow = (await kit.kit.web3.eth.getBlock("latest")).timestamp as number
      const accounts = await kit.kit.contracts.getAccounts()
      const lockedGold = await kit.kit.contracts.getLockedGold()
      switch (args.type) {
      case "withdraw":
        const rg = new ReleaseGoldWrapper(kit.kit, newReleaseGold(kit.kit.web3, args.from))
        kit.kit.defaultAccount = await rg.getBeneficiary()
        await withdrawPendingUnlocks(
          accounts, lockedGold, celoNow, setProgressMessage,
          args.from, rg)
        const txo = await rg.withdraw(amt.toFixed(0))
        setProgressMessage(`Confirm withdraw of ${args.amount} CELO from ${args.from} on your Ledger device...`)
        await txo.sendAndWaitForReceipt()
        break
      case "transfer":
        kit.kit.defaultAccount = args.from
        if (!args.to) {
          throw new Error(`Transfer To: address not set!`)
        }
        await withdrawPendingUnlocks(
          accounts, lockedGold, celoNow, setProgressMessage,
          args.from)
        setProgressMessage(`Confirm transfer of ${args.amount} CELO from ${args.from} ==> ${args.to} on your Ledger device...`)
        const txReceipt = await kit.kit.sendTransaction({
          from: args.from,
          to: args.to,
          value: amt.toFixed(0),
        })
        await txReceipt.waitReceipt()
        break
      }
    } finally {
      setNeedsRefresh(true)
    }
  }), [setProgressMessage, setNeedsRefresh])
  const { isOnGoing, onGoingConnected, initOnGoing, cancelOnGoing } = useLedgerKit(processTransfer, props.onError)


  const rgSelectedData = rgData.length === 0 ? undefined :
    (rgData.find((rg) => rg.contract.address === rgSelected) || rgData[0])
  const addrSelectedData = (addrData.length === 0) ? undefined :
    (addrData.find((a) => a.address.address === addrSelected) || addrData[0])
  return (
    <div>
      {(props.addressesHook.networkStatus === NetworkStatus.loading || props.addressesHook.networkStatus === NetworkStatus.refetch ||
        needsRefresh) &&
      <LinearProgress color="primary" />}
      <Dialog
        open={isOnGoing ? true : false}
        onClose={() => {
          if (onGoingConnected) {
            return // Don't allow closing while transactions are in progress.
          }
          cancelOnGoing()
        }}>
        <DialogTitle>Confirming</DialogTitle>
        <DialogContent>
          <UnlockLedgerInfo />
          {!onGoingConnected && <LinearProgress color="secondary" />}
          {onGoingConnected &&
          <div>
            <div style={{display: "flex", flexDirection: "row", alignItems: "center", marginTop: 20}}>
              <Typography color="secondary" variant="body2">
                {progressMessage}
              </Typography>
              <CircularProgress color="secondary" size={20} style={{marginLeft: 10}} />
            </div>
          </div>}
        </DialogContent>
      </Dialog>

      <UnlockLedgerInfo />
      {!needsRefresh && rgSelectedData &&
      <Box p={2}>
        <Typography variant="h5" component="h2">
          Withdraw
        </Typography>
        <Alert severity="info" style={{marginTop: 10, marginBottom: 10}}>
          Withdraw operation transfers released CELO from ReleaseGold contract to its beneficiary address. This is
          a fairly safe operation since funds can only be transferred to an address that you control.
        </Alert>
        <Alert severity="warning" style={{marginTop: 10, marginBottom: 10}}>
          Withdraw operation might perform multiple transactions to make
          recently unlocked CELO funds available
        </Alert>
        <div style={{
          display: "flex",
          flexDirection: "row",
          marginTop: 20,
          alignItems: "center"
          }}>
          <Typography variant="body1">From:</Typography>
          <Select
            native
            style={{marginLeft: 10, fontFamily: "monospace"}}
            value={rgSelectedData.contract.address}
            onChange={(e) => { setRGSelected(e.target.value as string) }}>
            {rgData.map((rg) => (
              <option key={rg.contract.address} value={rg.contract.address}>{rg.contract.address}</option>))}
          </Select>
        </div>
        <div>
            <Typography variant="body2">
              released: <code>{rgSelectedData.available.toFixed(2)} CELO</code>
            </Typography>
            <Typography variant="body2">
              unlocked <code>{rgSelectedData.unlocked.toFixed(2)} CELO</code>
            </Typography>
            <Typography variant="body2">
              pending: <code>{rgSelectedData.pending.toFixed(2)} CELO</code>
            </Typography>
        </div>
        <div style={{
          display: "flex",
          flexDirection: "row",
          marginTop: 10,
          alignItems: "center"
          }}>
          <TextField
            margin="dense"
            label={`CELO (max: ${BigNumber.minimum(rgSelectedData.available, rgSelectedData.unlocked)})`}
            variant="outlined"
            value={toWithdraw}
            size="small"
            type="number"
            onChange={(e) => { setToWithdraw(e.target.value) }}
          />
          <Button
            variant="contained"
            color="primary"
            style={{marginLeft: 10}}
            disabled={false}
            onClick={() => {
              const bfAddr = addresses?.find((a) => a.rgContracts.find((rg) => rg.address === rgSelectedData.contract.address))?.address
              const wPath = props.wallets.find((w) => w.address === bfAddr)?.path
              if (!wPath) {
                props.onError(new Error(`Beneficiary address not found on Ledger. Please refresh this page!`))
                return
              }
              const amt = Number.parseFloat(toWithdraw)
              if (!(amt > 0 && amt <= BigNumber.minimum(rgSelectedData.available, rgSelectedData.unlocked).toNumber())) {
                props.onError(new Error(`Withdraw amount: ${toWithdraw} is out of range!`))
                return
              }
              const kit = LedgerKit.init([celoPathIdx(wPath)])
              setProgressMessage("")
              initOnGoing(kit, {type: "withdraw", from: rgSelectedData.contract.address, amount: amt})
            }}
            >Withdraw</Button>
        </div>
      </Box>}
      {!needsRefresh && addrSelectedData &&
      <Box p={2}>
        <Typography variant="h5" component="h2">
          Transfer
        </Typography>
        <Alert severity="warning" style={{marginTop: 10, marginBottom: 10}}>
          Transfering CELO to an incorrect address can lead to permanent loss of your funds.
        </Alert>
        <Alert severity="warning" style={{marginTop: 10, marginBottom: 10}}>
          Always double check the transfer amount and destination address on your Ledger device before
          confirming the transaction.
        </Alert>
        <Alert severity="warning" style={{marginTop: 10, marginBottom: 10}}>
          Transfer operation might perform multiple transactions to make
          recently unlocked CELO funds available
        </Alert>
        <div style={{
          display: "flex",
          flexDirection: "row",
          marginTop: 20,
          alignItems: "center"
          }}>
          <Typography variant="body1">From:</Typography>
          <Select
            native
            style={{marginLeft: 10, fontFamily: "monospace"}}
            value={addrSelectedData.address.address}
            onChange={(e) => { setAddrSelected(e.target.value as string) }}>
            {addrData.map((a) => (
              <option key={a.address.address} value={a.address.address}>{a.address.address}</option>))}
          </Select>
        </div>
        <div>
            <Typography variant="body2">
              available: <code>{addrSelectedData.available.toFixed(2)} CELO</code>
            </Typography>
            <Typography variant="body2">
              pending: <code>{addrSelectedData.pending.toFixed(2)} CELO</code>
            </Typography>
        </div>
        <div style={{
          display: "flex",
          flexDirection: "row",
          marginTop: 10,
          alignItems: "center"
          }}>
          <Typography variant="body1">To:</Typography>
          <TextField
            margin="dense"
            label={`Address`}
            variant="outlined"
            value={toAddr}
            size="small"
            style={{marginLeft: 10, width: 400}}
            onChange={(e) => { setToAddr(e.target.value) }}
          />
          <TextField
            margin="dense"
            label={`CELO (max: ${addrSelectedData.available.toFixed(2)})`}
            variant="outlined"
            value={toTransfer}
            size="small"
            type="number"
            style={{marginLeft: 10}}
            onChange={(e) => { setToTransfer(e.target.value) }}
          />
          <Button
            variant="contained"
            color="primary"
            style={{marginLeft: 10}}
            disabled={false}
            onClick={() => {
              const wPath = props.wallets.find((w) => w.address === addrSelectedData.address.address)?.path
              if (!wPath) {
                props.onError(new Error(`Beneficiary address not found on Ledger. Please refresh this page!`))
                return
              }
              const amt = Number.parseFloat(toTransfer)
              if (!(amt > 0 && amt <= addrSelectedData.available.toNumber())) {
                props.onError(new Error(`Transfer amount: ${toTransfer} is out of range!`))
                return
              }
              if (toAddr === "") {
                props.onError(new Error(`To address must be provided!`))
                return
              }
              const kit = LedgerKit.init([celoPathIdx(wPath)])
              setProgressMessage("")
              initOnGoing(kit, {type: "transfer", from: addrSelectedData.address.address, to: toAddr, amount: amt})
            }}
            >Transfer</Button>
        </div>
      </Box>
      }
    </div>
  )
}

async function withdrawPendingUnlocks(
  accounts: AccountsWrapper,
  lockedGold: LockedGoldWrapper,
  now: number,
  setProgressMessage: (msg: string) => void,
  from: string,
  rg?: ReleaseGoldWrapper) {
  const isAccount = await accounts.isAccount(from)
  if (!isAccount) {
    return
  }
  withdrawPendingLoop:
  while (true) {
    const pendings = await lockedGold.getPendingWithdrawals(from)
    for (let idx = 0; idx < pendings.length; idx += 1) {
      if (!pendings[idx].time.isLessThan(now)) {
        continue
      }
      let txo
      if (rg) {
        txo = await rg.withdrawLockedGold(idx)
      } else {
        txo = await lockedGold.withdraw(idx)
      }
      setProgressMessage(`Finalize unlock of ${pendings[idx].value.div(1e18).toFixed(2)} CELO...`)
      await txo.sendAndWaitForReceipt()
      continue withdrawPendingLoop
    }
    return
  }
}

async function checkPendingLockedGold(
  accounts: AccountsWrapper,
  lockedGold: LockedGoldWrapper,
  address: string,
  now: number) {
  const isAccount = await accounts.isAccount(address)
  if (!isAccount) {
    return {ready: new BigNumber(0), pending: new BigNumber(0)}
  }
  const pendings = await lockedGold.getPendingWithdrawals(address)
  const ready = pendings.filter((p) => p.time.isLessThan(now)).reduce((p, v) => p.plus(v.value), new BigNumber(0)).div(1e18)
  const pending = pendings.filter((p) => !p.time.isLessThan(now)).reduce((p, v) => p.plus(v.value), new BigNumber(0)).div(1e18)
  return {ready, pending}
}