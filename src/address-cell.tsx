import React from 'react'
import Link from '@material-ui/core/Link';
import { explorerURI } from './schema';

export default function AddressCell(props: {address: string, short?: boolean}) {
  let addr = props.address
  if (props.short) {
    addr = addr.slice(0, 6) + "..." + addr.slice(addr.length - 4, addr.length)
  }
  return (
    <Link href={`${explorerURI}/address/${props.address}`} target="_blank">
      <code>{addr}</code>
    </Link>
  )
}