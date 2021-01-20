import TransportUSB from '@ledgerhq/hw-transport-webusb'
import TransportU2F from '@ledgerhq/hw-transport-u2f'
import { ContractKit, newKit } from '@celo/contractkit'
import { LedgerWallet, newLedgerWalletWithSetup, AddressValidation } from '@celo/contractkit/lib/wallets/ledger-wallet'
import { celoURI } from './schema'
import { useState, useEffect } from 'react'

declare global {
  interface Window {
    USB: any
  }
}

export interface WalletAddress {
  path: string
  address: string
}

export async function connectTransport() {
  // try {
  const transport = await TransportU2F.create()
  return transport
  // } catch (e) {
  //   if (window.USB && TransportUSB.isSupported()) {
  //     const transport = await TransportUSB.create()
  //     return transport
  //   }
  // }
  // throw new Error(`Browser not supported. Use latest version of Chrome, Edge or Opera!`)
}

export function celoAddressPath(idx: number): string {
  return "44'/52752'/0'/0/" + idx
}

export function celoPathIdx(path: string): number {
  return Number(path.split("/").pop())
}

export class LedgerKit {
  private closed = false
  private constructor (public kit: ContractKit, public wallet: LedgerWallet) {}

  public static async init(idxs: number[]) {
    const transport = await connectTransport()
    try {
      const wallet = await newLedgerWalletWithSetup(
        transport, idxs, undefined, AddressValidation.never)
      const kit = newKit(celoURI, wallet)
      return new LedgerKit(kit, wallet)
    } catch (e) {
      transport.close()
      throw (e)
    }
  }

  close = () => {
    if (this.closed) {
      return
    }
    this.closed = true
    this.wallet.transport.close()
    this.kit.stop()
  }
}

export function useLedgerKit<T>(
  call: (kit: LedgerKit, args: T) => Promise<unknown>,
  onError: (error: Error) => void) {
  const [ onGoing, setOnGoing ] = useState<{kit: Promise<LedgerKit>, args: T} | null>(null)
  const [ onGoingConnected, setOnGoingConnected ] = useState(false)
  const cancelOnGoing = () => {
    setOnGoingConnected(false)
    setOnGoing(null)
  }
  const [ onGoingError, setOnGoingError ] = useState<Error | null>(null)
  useEffect(() => {
    if (onGoingError) {
      onError(onGoingError)
    }
    setOnGoingError(null)
  }, [onGoingError, onError])
  useEffect(() => {
    if (!onGoing) {
      return
    }
    let cancelled = false;
    (async () => {
      const kit = await onGoing.kit
      setOnGoingConnected(true)
      await call(kit, onGoing.args)
    })()
    .catch((err) => {
      if (!cancelled) {
        setOnGoingError(err)
      }
    }).
    finally(cancelOnGoing)

    return () => {
      cancelled = true
      onGoing.kit.then((k) => k.close())
    }
  }, [onGoing, call, setOnGoingError])

  const isOnGoing = onGoing !== null
  const initOnGoing = (kit: Promise<LedgerKit>, args: T) => {
    setOnGoingConnected(false)
    setOnGoing({kit: kit, args: args})
  }
  return {isOnGoing, onGoingConnected, initOnGoing, cancelOnGoing}
}

