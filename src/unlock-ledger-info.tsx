import React from 'react'
import Alert from "@material-ui/lab/Alert"
import Link from "@material-ui/core/Link"

const UnlockLedgerInfo = (props: {}) => (
  <Alert severity="info" style={{marginTop: 10, marginBottom: 10}}>
    Make sure your <Link
      target="_blank"
      rel="noreferrer"
      href="https://www.ledger.com">Ledger</Link> wallet
    is unlocked and <Link
      target="_blank"
      rel="noreferrer"
      href="https://docs.celo.org/celo-gold-holder-guide/ledger#install-the-celo-application">Celo app</Link> is launched.
  </Alert>
)
export default UnlockLedgerInfo