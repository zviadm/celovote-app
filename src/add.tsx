import React, { useState } from 'react'
import { WalletAddress, connectTransport, celoAddressPath } from './ledger'
import TextField from '@material-ui/core/TextField'
import Fab from '@material-ui/core/Fab'
import Eth from '@ledgerhq/hw-app-eth'
import Add from '@material-ui/icons/Add';
import CircularProgress from '@material-ui/core/CircularProgress';
import Button from '@material-ui/core/Button';
import UnlockLedgerInfo from './unlock-ledger-info'

export default function AddWallet(props: {
  isInitialized: boolean
  onAdd: (wallet: WalletAddress[]) => void
  onError: (error: Error) => void
}) {
  const initialIdxs = "0-1"
  const [ isLoading, setIsLoading ] = useState(false)
  const [ addressIdxs, setAddressIdxs ] = useState(initialIdxs)

  const walletsAdd = (idxs: string) => {
    setIsLoading(true)
    celoAddressesFromLedger(idxs)
    .then(props.onAdd)
    .catch(props.onError)
    .finally(() => {
      setIsLoading(false)
    })
  }

  return (
    <div style={{display: "flex", flexDirection: "column", alignItems: "flex-start"}}>
      <UnlockLedgerInfo />
      {
        (!props.isInitialized) ? (
        <Button
          variant="contained"
          color="primary"
          onClick={() => { walletsAdd(initialIdxs) }}
          disabled={isLoading}
          >Connect Ledger</Button>
        ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
          }}>
          <TextField
            label="Ledger Addresses"
            variant="outlined"
            value={addressIdxs}
            size="small"
            style={{marginRight: 10}}
            onChange={(e) => { setAddressIdxs(e.target.value) }}
          />
          <div style={{position: 'relative'}}>
            <Fab
              color="primary"
              size="small"
              onClick={() => { walletsAdd(addressIdxs) }}
              disabled={isLoading}>
              <Add />
            </Fab>
            {
              isLoading &&
              <CircularProgress
                size={40}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  zIndex: 1,
                }}
              />
            }
          </div>
        </div>
        )
      }
    </div>
  )
}

export async function celoAddressesFromLedger(addressIdxs: string, verify?: boolean) {
  const idxs = parseRange(addressIdxs)
  const transport = await connectTransport()
  try {
    const eth = new Eth(transport)
    const r: WalletAddress[] = []
    for (const idx of idxs) {
      const path = celoAddressPath(idx)
      const addr = await eth.getAddress(path, verify)
      r.push({ path: path, address: addr.address })
    }
    return r
  } finally {
    await transport.close()
  }
}

function parseRange(s: string) {
  let res = [];
  let m;

  for (let str of s.split(",").map((str) => str.trim())) {
    // just a number
    if (/^-?\d+$/.test(str)) {
      res.push(parseInt(str, 10));
    } else if (
      (m = str.match(/^(-?\d+)(-|\.\.\.?|\u2025|\u2026|\u22EF)(-?\d+)$/))
    ) {
      // 1-5 or 1..5 (equivalent) or 1...5 (doesn't include 5)
      let [_, lhsS, sep, rhsS] = m;

      if (lhsS && rhsS) {
        const lhs = parseInt(lhsS);
        let rhs = parseInt(rhsS);
        const incr = lhs < rhs ? 1 : -1;

        // Make it inclusive by moving the right 'stop-point' away by one.
        if (sep === "-" || sep === ".." || sep === "\u2025") rhs += incr;

        for (let i = lhs; i !== rhs; i += incr) res.push(i);
      }
    }
  }

  return res;
}
