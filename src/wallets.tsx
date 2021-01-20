import React, { useState, useEffect, useCallback } from 'react'
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import VisibilityOff from '@material-ui/icons/VisibilityOff';
import Sync from '@material-ui/icons/Sync';
import CheckCircle from '@material-ui/icons/CheckCircle';
import CircularProgress from '@material-ui/core/CircularProgress';
import Table from '@material-ui/core/Table';
import TableRow from '@material-ui/core/TableRow';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableBody from '@material-ui/core/TableBody';
import LinearProgress from '@material-ui/core/LinearProgress';
import AccountBalanceWallet from '@material-ui/icons/AccountBalanceWallet';
import Typography from '@material-ui/core/Typography';
import Tooltip from '@material-ui/core/Tooltip';
import Link from '@material-ui/core/Link';
import AddressCell from './address-cell';
import LockGoldModal from './lock-gold';
import Dialog from '@material-ui/core/Dialog';
import DialogTitle from '@material-ui/core/DialogTitle';
import DialogContent from '@material-ui/core/DialogContent';
import Alert from '@material-ui/lab/Alert';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';

import { gql, NetworkStatus } from 'apollo-boost';
import { useMutation } from '@apollo/react-hooks';
import { QueryResult } from '@apollo/react-common';

import { newReleaseGold } from '@celo/contractkit/lib/generated/ReleaseGold'
import { ReleaseGoldWrapper } from '@celo/contractkit/lib/wrappers/ReleaseGold'
import { serializeSignature } from '@celo/utils/lib/signatureUtils'

import { Address, BaseAddress, Signer, minLockedGold } from './schema';
import { WalletAddress, celoPathIdx, LedgerKit, useLedgerKit, celoAddressPath } from './ledger'
import { celoAddressesFromLedger } from './add';
import UnlockLedgerInfo from './unlock-ledger-info';

const mSignPOP = gql`
  mutation signPOP($address: String!) {
    signPOP(address: $address) {
      signer
      signature {v r s}
    }
  }
`;

const mAutoVote = gql`
  mutation autoVote($address: String!) {
    autoVote(addresses: [$address])
  }
`;


export default function WalletTable(props: {
  wallets: WalletAddress[],
  addressesHook: QueryResult<any, {addresses: string[]}>,
  onRefresh: () => Promise<unknown>,
  onRemove: (address: string) => void,
  onError: (error: Error) => void,
}) {
  const [ signPOP ] = useMutation(mSignPOP)
  const [ autoVote ] = useMutation(mAutoVote)
  const [ editLockedGold, setEditLockedGold ] = useState<{
    idx: number,
    address?: BaseAddress,
    isReleaseGold?: boolean,
  }>({idx: -1})
  const [ needsRefresh, setNeedsRefresh ] = useState<boolean | undefined>(undefined)
  const onRefresh = props.onRefresh
  useEffect(() => {
    if (needsRefresh === undefined) {
      return
    }
    if (needsRefresh) {
      onRefresh()
    }
    setEditLockedGold({idx: -1})
    setNeedsRefresh(undefined)
  }, [needsRefresh, onRefresh])

  const [ progressMessage, setProgressMessage ] = useState("")
  const processAuthorize = useCallback((async (
    kit: LedgerKit,
    args: {
      address: string,
      isReleaseGold: boolean}) => {
    try {
      const data = await signPOP({variables: {address: args.address}})
      const signer: Signer = data.data.signPOP
      let txo
      if (args.isReleaseGold) {
        const rg = new ReleaseGoldWrapper(kit.kit, newReleaseGold(kit.kit.web3, args.address))
        kit.kit.defaultAccount = await rg.getBeneficiary()
        txo = await rg.authorizeVoteSigner(signer.signer, signer.signature)
      } else {
        kit.kit.defaultAccount = args.address
        const accounts = await kit.kit.contracts.getAccounts()
        txo = await accounts.authorizeVoteSigner(signer.signer, signer.signature)
      }
      setProgressMessage(`Waiting for approval to authorize ${args.address} with Celovote...`)
      await txo.sendAndWaitForReceipt()
      // send `autoVote` mutation, but don't wait for its result, since voting can
      // be very slow and no need to have user wait for it synchronously.
      autoVote({variables: {address: args.address}})
    } finally {
      setNeedsRefresh(true)
    }
  }), [signPOP, autoVote, setProgressMessage, setNeedsRefresh])
  const { isOnGoing, onGoingConnected, initOnGoing, cancelOnGoing } = useLedgerKit(processAuthorize, props.onError)

  const [ isOnGoingWithCLI, setIsOnGoingWithCLI ] = useState(false)
  const [ actionsOpen, setActionsOpen] = useState<{address: string, anchorEl: HTMLElement} | undefined>()

  const onAuthorize = (using: "ledger" | "cli", idx: number, address: string, isReleaseGold: boolean) => {
    switch (using) {
    case "ledger":
      const kit = LedgerKit.init([idx])
      setProgressMessage("")
      initOnGoing(kit, {address: address, isReleaseGold: isReleaseGold})
      break
    case "cli":
      setProgressMessage("")
      setIsOnGoingWithCLI(true);
      (async () => {
        const data = await signPOP({variables: {address: address}})
        const signer: Signer = data.data.signPOP
        if (!isReleaseGold) {
          setProgressMessage(
            `celocli account:authorize \\\n` +
            `  --useLedger --ledgerCustomAddresses "[${idx}]" \\\n` +
            `  --role vote \\\n` +
            `  --from ${address} \\\n` +
            `  --signer ${signer.signer} \\\n` +
            `  --signature ${serializeSignature(signer.signature)}`)
        } else {
          setProgressMessage(
            `celocli releasegold:authorize \\\n` +
            `  --useLedger --ledgerCustomAddresses "[${idx}]" \\\n` +
            `  --role vote \\\n` +
            `  --contract ${address} \\\n` +
            `  --signer ${signer.signer} \\\n` +
            `  --signature ${serializeSignature(signer.signature)}`)
        }
      })()
      .catch((err) => {
        props.onError(err)
        setIsOnGoingWithCLI(false)
      })
      break
    }
  }

  const addressIdxs = new Map(props.wallets.map((w) => [w.address, celoPathIdx(w.path)]))
  let rows: JSX.Element[][] = []
  if (props.addressesHook.data) {
    const addresses: Address[] = props.addressesHook.data.addresses

    rows = addresses.map((a) => {
      const idx = addressIdxs.get(a.address)
      if (idx === undefined) {
        return []
      }
      const row = AddressRow({
        idx: idx,
        addr: a,
        actionsOpen: actionsOpen?.address === a.address ? actionsOpen.anchorEl : undefined,
        setActionsOpen: (anchorEl) =>
          setActionsOpen(anchorEl ? {address: a.address, anchorEl: anchorEl} : undefined),
        onRemove: props.onRemove,
        onAuthorize: (using) => { onAuthorize(using, idx, a.address, false) },
        onEditLockedGold: () => { setEditLockedGold({idx: idx, address: a}) },
        onError: props.onError,
      })
      const rgRows = a.rgContracts.map((rg) => (
        AddressRow({
          addr: rg,
          actionsOpen: actionsOpen?.address === rg.address ? actionsOpen.anchorEl : undefined,
          setActionsOpen: (anchorEl) =>
            setActionsOpen(anchorEl ? {address: rg.address, anchorEl: anchorEl} : undefined),
          onRemove: props.onRemove,
          onAuthorize: (using) => { onAuthorize(using, idx, rg.address, true) },
          onEditLockedGold: () => { setEditLockedGold({idx: idx, address: rg, isReleaseGold: true}) },
          onError: props.onError,
        })
      ))
      return [row, ...rgRows]
    })
  }

  return (
    <div>
      <LockGoldModal
        idx={editLockedGold.idx}
        address={editLockedGold.address}
        isReleaseGold={editLockedGold.isReleaseGold}
        onError={props.onError}
        onClose={setNeedsRefresh}
        />
      <Dialog
        open={isOnGoing ? true : false}
        onClose={() => {
          if (onGoingConnected) {
            return // Don't allow closing while transactions are in progress.
          }
          cancelOnGoing()
        }}>
        <DialogTitle>Authorizing</DialogTitle>
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
      <Dialog
        open={isOnGoingWithCLI ? true : false}
        onClose={() => {
          setIsOnGoingWithCLI(false)
          props.onRefresh()
        }}
        >
        <DialogTitle>Authorize using CLI</DialogTitle>
        <DialogContent>
          {progressMessage === "" && <LinearProgress color="secondary" />}
          {progressMessage !== "" &&
          <div>
            <Typography variant="body2" color="textSecondary">
              Run following command to authorize Celovote to manage voting for your account
            </Typography>
            <pre>
              {progressMessage}
            </pre>
          </div>}
        </DialogContent>
      </Dialog>
      <div>
        <Table aria-label="wallet addresses">
          <TableHead>
            <TableRow>
              <TableCell size="small"></TableCell>
              <TableCell size="small">address</TableCell>
              <TableCell size="small" align="right" style={{whiteSpace: "nowrap"}}>locked CELO</TableCell>
              <TableCell size="small" align="right" style={{whiteSpace: "nowrap"}}>total CELO</TableCell>
              <TableCell size="small"></TableCell>
              <TableCell size="small" align="center">
                <Tooltip title="Refresh">
                  <IconButton
                    aria-label="hide" size="small"
                    onClick={() => { props.onRefresh() }} >
                    <Sync color="secondary" />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
            {(props.addressesHook.networkStatus === NetworkStatus.loading || props.addressesHook.networkStatus === NetworkStatus.refetch) &&
            <TableRow><TableCell size="small" colSpan={6}><LinearProgress color="primary" /></TableCell></TableRow>}
          </TableHead>
          <TableBody>
            {rows}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function AddressRow(props: {
  idx?: number,
  addr: BaseAddress,
  actionsOpen?: HTMLElement,
  setActionsOpen: (anchorEl?: HTMLElement) => void,
  onRemove: (address: string) => void,
  onAuthorize: (using: "ledger" | "cli") => void,
  onEditLockedGold: () => void,
  onError: (error: Error) => void,
}) {
  let action
  if (props.addr.authorized) {
    action = (
      <Tooltip title="Managed by Celovote">
        <CheckCircle style={{verticalAlign: "middle"}} />
      </Tooltip>
    )
  } else {
    const enoughLocked = props.addr.lockedGold >= minLockedGold.toNumber()
    action = (
      <div>
        <Tooltip title={enoughLocked ?
          "Authorize to be managed by Celovote" :
          <div>{`Not enough locked CELO to authorize`}<br />{`Minimum ${minLockedGold.div(1e18).toFixed(0)} CELO required`}</div>
        }>
          <span>
            <Button
              id={`action-${props.addr.address}`}
              aria-owns={props.actionsOpen ? 'action-menu' : undefined}
              aria-haspopup="true"
              variant="contained" size="small"
              onClick={ (event: React.MouseEvent<HTMLElement>) => { props.setActionsOpen(event.currentTarget) }}
              disabled={!enoughLocked}
            >
              Authorize
            </Button>
          </span>
        </Tooltip>
        <Menu
          id="action-menu"
          open={props.actionsOpen ? true : false}
          anchorEl={props.actionsOpen!}
          onClose={ () => props.setActionsOpen(undefined) }
          onMouseLeave={ (event: React.MouseEvent<HTMLElement>) => { props.setActionsOpen(undefined) }}
        >
          <MenuItem onClick={() => { props.onAuthorize("ledger") }}>using Ledger</MenuItem>
          <MenuItem onClick={() => { props.onAuthorize("cli") }}>using CLI</MenuItem>
        </Menu>
      </div>
    )
  }
  const isRG = (props.idx === undefined)
  const name = props.addr.name.length > 0 ? props.addr.name : props.addr.address
  return (
    <TableRow key={props.addr.address}>
      <TableCell size="small">
        {!isRG &&
        <Typography noWrap>
          <Tooltip
            title={
              <div>
                {`Click to verify on Ledger`}<br />
                {`Path: ${celoAddressPath(props.idx!)}`}
              </div>}>
            <IconButton
              aria-label="hide"
              size="small"
              style={{verticalAlign: "middle"}}
              color="primary"
              onClick={() => { queueAddressVerification(props.idx!, props.onError) }}>
              <AccountBalanceWallet />
            </IconButton>
          </Tooltip>
          <code>{props.idx}</code>
        </Typography>}
      </TableCell>
      <TableCell size="small">
        <Tooltip title={isRG ? `ReleaseGold contract: ${name}` : `Account: ${name}`}>
          <div>
            {isRG && <span style={{verticalAlign: "middle"}}>{"\u21b3"}</span> }
            <AddressCell address={props.addr.address} />
          </div>
        </Tooltip>
      </TableCell>
      <TableCell size="small" align="right">
        <Tooltip title="Lock or unlock CELO">
          <Link component="button" variant="body2" underline="hover" onClick={props.onEditLockedGold}>
            {(props.addr.lockedGold / 1e18).toFixed(2)}
          </Link>
        </Tooltip>
      </TableCell>
      <TableCell size="small" align="right">{(props.addr.totalGold / 1e18).toFixed(2)}</TableCell>
      <TableCell size="small" align="center">{action}</TableCell>
      <TableCell size="small" align="center">
        <div style={{visibility: !isRG ? "visible" : "hidden"}}>
          <Tooltip title="Hide this address and all associated ReleaseGold contracts">
            <IconButton
              aria-label="hide"
              size="small"
              onClick={() => { props.onRemove(props.addr.address) }} ><VisibilityOff /></IconButton>
          </Tooltip>
        </div>
      </TableCell>
    </TableRow>
  )
}

let _queuedIdx = -1
function queueAddressVerification(idx: number, onError: (error: Error) => void) {
  if (_queuedIdx === -1) {
    _queuedIdx = idx
    celoAddressesFromLedger(idx.toString(), true)
    .catch(onError)
    .finally(() => {_queuedIdx = -1})
    return
  }
  if (_queuedIdx !== idx) {
    onError(new Error(`Address verification in progress for index: ${_queuedIdx}`))
  }
}