import React, { useState, useEffect, useCallback } from 'react'
import Dialog from '@material-ui/core/Dialog';
import Button from '@material-ui/core/Button';
import DialogTitle from '@material-ui/core/DialogTitle';
import DialogContent from '@material-ui/core/DialogContent';
import DialogActions from '@material-ui/core/DialogActions';
import TextField from '@material-ui/core/TextField';
import Alert from '@material-ui/lab/Alert';
import CircularProgress from '@material-ui/core/CircularProgress';
import Typography from '@material-ui/core/Typography';

import { ContractKit } from '@celo/contractkit';
import { ReleaseGoldWrapper } from '@celo/contractkit/lib/wrappers/ReleaseGold';
import { newReleaseGold } from '@celo/contractkit/lib/generated/ReleaseGold';
import BigNumber from "bignumber.js";

import { BaseAddress, IsDev } from './schema';
import { LedgerKit, useLedgerKit } from './ledger';
import Link from '@material-ui/core/Link';
import UnlockLedgerInfo from './unlock-ledger-info';

export default function LockGoldModal(props: {
  idx: number,
  address?: BaseAddress,
  isReleaseGold?: boolean,
  onError: (error: Error) => void,
  onClose: (updated: boolean) => void,
}) {
  const [ lockedGold, setLockedGold ] = useState<string | undefined>()
  useEffect(() => {
    if (props.address) {
      setLockedGold((props.address.lockedGold / 1e18).toFixed(2))
    }
  }, [props.address])
  const [ progressMessage, setProgressMessage ] = useState("")

  const onClose = props.onClose
  const process = useCallback((async (
    kit: LedgerKit,
    args: {
      address: string,
      isReleaseGold: boolean,
      targetGold: BigNumber}) => {
    await updateLockedGold(
      kit.kit,
      args.address,
      args.isReleaseGold,
      args.targetGold,
      setProgressMessage)
    onClose(true)
  }), [onClose])
  const { isOnGoing, onGoingConnected, initOnGoing, cancelOnGoing } = useLedgerKit(process, props.onError)

  const goldBuffer = (IsDev() && !props.isReleaseGold) ? 0.1 : 3
  const totalGold = (!props.address) ? 0 :
    BigNumber.maximum(((props.address.totalGold / 1e18) - goldBuffer), 0).decimalPlaces(2, BigNumber.ROUND_DOWN)
  return (
    <Dialog
      open={props.idx > -1}
      onClose={() => {
        if (onGoingConnected) {
          return // Don't allow closing while transactions are in progress.
        }
        onClose(false)
        cancelOnGoing()
      }}
      maxWidth="xs"
    >
      <DialogTitle>Update Locked CELO amount</DialogTitle>
      <DialogContent>
        <UnlockLedgerInfo />
        <Alert severity="warning" style={{marginTop: 10}}>
          Locked CELO has a delay of <Link
            target="_blank"
            rel="noreferrer"
            href="https://docs.celo.org/celo-codebase/protocol/proof-of-stake/locked-gold#unlocking-period">3 days</Link> before it
            can be recovered from the escrow after unlock is initiated.</Alert>
        <Alert severity="warning" style={{marginTop: 10}}>
          Changing locked CELO amount can require multiple transactions. Make sure you approve all of them using
          your Ledger wallet.</Alert>
        <div>
          <TextField
            autoFocus
            margin="dense"
            label={`Locked CELO (max: ${totalGold.toFixed(2)})`}
            variant="outlined"
            value={lockedGold}
            size="small"
            type="number"
            fullWidth={true}
            style={{marginTop: 20}}
            onChange={(e) => { setLockedGold(e.target.value) }}
          />
        </div>
      </DialogContent>
      <DialogActions>
        {!isOnGoing ?
        (<Button
          color="primary"
          variant="contained"
          onClick={() => {
            let targetGold = new BigNumber(lockedGold!)
            if (targetGold.gt(totalGold)) {
              props.onError(new Error(`Requested amount ${targetGold.toFixed(2)} CELO exceeds maximum allowed ${totalGold} CELO`))
              return
            }
            targetGold = targetGold.multipliedBy(1e18)
            const kit = LedgerKit.init([props.idx])
            setProgressMessage("")
            initOnGoing(kit, {
              address: props.address!.address,
              isReleaseGold: props.isReleaseGold || false,
              targetGold: targetGold,
            })
          }}>
          Update
        </Button>)
        :
        (<div style={{display: "flex", flexDirection: "row", alignItems: "center"}}>
          <Typography color="secondary" variant="body2" component="span">
            {progressMessage}
          </Typography>
          <CircularProgress color="secondary" size={20} style={{marginLeft: 10}} />
        </div>)}
      </DialogActions>
    </Dialog>
  )
}

async function updateLockedGold(
  kit: ContractKit,
  address: string,
  isReleaseGold: boolean,
  targetGold: BigNumber,
  setProgress: (msg: string) => void) {
  let rg: ReleaseGoldWrapper | null = null
  if (isReleaseGold) {
    rg = new ReleaseGoldWrapper(kit, newReleaseGold(kit.web3, address))
    kit.defaultAccount = await rg.getBeneficiary()
  } else {
    kit.defaultAccount = address
  }

  const accounts = await kit.contracts.getAccounts()
  const isAccount = await accounts.isAccount(address)
  if (!isAccount) {
    let tx
    if (rg) {
      tx = rg.createAccount()
    } else {
      tx = accounts.createAccount()
    }
    setProgress(`Waiting for approval to create account...`)
    await tx.sendAndWaitForReceipt()
  }

  const lockedGold = await kit.contracts.getLockedGold()
  let locked = await lockedGold.getAccountTotalLockedGold(address)
  let delta = targetGold.minus(locked)
  if (delta.gt(0)) {
    const pendingWithdrawals = await lockedGold.getPendingWithdrawalsTotalValue(address)
    const toRelock = BigNumber.minimum(pendingWithdrawals, delta)
    const toLock = delta.minus(toRelock)

    let txs
    if (rg) {
      txs = await rg.relockGold(toRelock)
    } else {
      txs = await lockedGold.relock(address, toRelock)
    }
    let idx = 0
    for (const tx of txs) {
      idx += 1
      setProgress(`Waiting for approval (${idx} of ${txs.length}) to relock ${toRelock.dividedBy(1e18).toFixed(2)} CELO...`)
      await tx.sendAndWaitForReceipt()
    }
    if (toLock.gt(new BigNumber(0))) {
      setProgress(`Waiting for approval to lock ${toLock.dividedBy(1e18).toFixed(2)} CELO...`)
      if (rg) {
        const tx = rg.lockGold(toLock)
        await tx.sendAndWaitForReceipt()
      } else {
        const tx = lockedGold.lock()
        await tx.sendAndWaitForReceipt({value: toLock.toFixed()})
      }
    }
  } else if (delta.lt(0)) {
    const election = await kit.contracts.getElection()
    delta = delta.negated()
    do  {
      const voter = await election.getVoter(address)
      const votesTotal = await voter.votes.map((v) => v.active.plus(v.pending)).reduce((s, v) => s.plus(v), new BigNumber(0))

      let toUnlock = BigNumber.minimum(delta, locked.minus(votesTotal))
      if (toUnlock.lte(0)) {
        // Need to revoke some votes first, before unlocking. First check if there is a group with enough
        // pending votes to unlock only those. Otherwise, to make it easier on the user,
        // revoke from group with the most votes first, to hopefully avoid multiple revoke/unlock
        // transactions. Celovote auto voter will rebalance votes in the background later on anyways.
        let toRevoke
        let toRevokeList = voter.votes.filter((v) => v.pending.gte(delta))
        if (toRevokeList.length === 0) {
          toRevokeList = voter.votes.filter((v) => v.active.plus(v.pending).gte(delta))
        }
        if (toRevokeList.length > 0) {
          // choose smallest from `toRevokeList`
          toRevoke = toRevokeList.reduce((m, v) => (v.active.plus(v.pending).lt(m.pending.plus(m.active)) ? v : m))
        } else {
          // choose largest from `voter.votes`
          toRevoke = voter.votes.reduce((m, v) => (v.active.plus(v.pending).gt(m.pending.plus(m.active)) ? v : m))
        }
        toUnlock = BigNumber.minimum(delta, toRevoke.active.plus(toRevoke.pending))
        let txs
        if (rg) {
          txs = await rg.revoke(address, toRevoke.group, toUnlock)
        } else {
          txs = await election.revoke(address, toRevoke.group, toUnlock)
        }
        let idx = 0
        for (const tx of txs) {
          idx += 1
          setProgress(`Waiting for approval (${idx} of ${txs.length}) to revoke ${toUnlock.dividedBy(1e18).toFixed(2)} votes before unlocking...`)
          await tx.sendAndWaitForReceipt()
        }
      }

      let tx
      if (rg) {
        tx = await rg.unlockGold(toUnlock)
      } else {
        tx = await lockedGold.unlock(toUnlock)
      }
      setProgress(`Waiting for approval to unlock ${toUnlock.dividedBy(1e18).toFixed(2)} CELO...`)
      await tx.sendAndWaitForReceipt()
      delta = delta.minus(toUnlock)
      locked = locked.minus(toUnlock)
    } while (delta.gt(0))
  }
}
