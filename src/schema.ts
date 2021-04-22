// This file is shared between API & APP code, thus must only include stuff
// that is needed by both and can be imported by both.
import { gql } from "apollo-boost";
import BigNumber from "bignumber.js";

export function IsDev() {
  return process.env.NODE_ENV === 'development'
}

export const celoURI = IsDev() ? "https://baklava-forno.celo-testnet.org" : (process.env.CELO_URI || "https://celorpc.celovote.com")
export const explorerURI = IsDev() ? "https://baklava-blockscout.celo-testnet.org" : "https://explorer.celo.org"
export const celovoteGQL = IsDev() ? "http://localhost:4000" : "https://gql.celovote.com"

export const minLockedGold = IsDev() ? new BigNumber(0.1e18) : new BigNumber(100e18)
export const electionMinVotes = new BigNumber(1500000e18)

// GraphQL schema
export const typeDefs = gql`
type Query {
  addresses(addresses: [String!]!): [Address!]!
  addressVotes(addresses: [String!]!): [AddressVotes!]!
  addressRewards(addresses: [String!]!): [EpochReward!]!
  faucetAddress: String!
  estimatedAPYs(groups: [String!], epochLookback: Int!): [GroupEstimatedAPY!]!
  targetAPY: Float!
  currentEpoch: Int!
  governanceProposals: GovernanceProposals!
  savingsCELOTotalSupply: SavingsCELOTotalSupply!
}

type Mutation {
  signPOP(address: String!): Signer!
  autoVote(addresses: [String!]!): [String!]!

  proxyGovernance(
    from: String!,
    typedDataJSON: String!,
    typedDataSignature: String!,
  ): Boolean!
}

type Address {
  address: String!
  name: String!
  authorized: Boolean!
  lockedGold: Float!
  balanceGold: Float!
  totalGold: Float!
  rgContracts: [RGContract!]!
}

type RGContract {
  address: String!
  name: String!
  authorized: Boolean!
  lockedGold: Float!
  balanceGold: Float!
  totalGold: Float!
}

type Signer {
  signer: String!
  signature: Signature!
}

type Signature {
  v: Int!
  r: String!
  s: String!
}

type AddressVotes {
  address: String!
  lockedGold: Float!
  votes: [GroupVotes!]!
}

type GroupVotes {
  group: Group!
  active: Float!
  pending: Float!
}

type Group {
  address: String!
  name: String!
  domain: String
}

type GroupEstimatedAPY {
  group: Group!
  isElected: Boolean!
  epochN: Int!
  estimatedAPY: Float!
}

type GovernanceProposals {
  queued: [QueuedProposal!]!
  voting: [VotingProposal!]!
}

type QueuedProposal {
  upvotes: Float!
  proposal: GovernanceProposal!
}

type VotingProposal {
  proposal: GovernanceProposal!
  votes: ProposalVotes!
}
type ProposalVotes {
  yes: Float!
  no: Float!
  abstain: Float!
}

type GovernanceProposal {
  id: Int!
  proposer: String!
  descriptionURL: String!
}

type EpochReward {
  timestampMs: Float!
  epoch: Int!
  asGold: Float!
  asUSD: Float!
}

type SavingsCELOTotalSupply {
  celoWEI: String!
  sceloWEI: String!
}
`

export interface Address extends BaseAddress {
  rgContracts: Array<BaseAddress>
}

export interface BaseAddress {
  address: string
  name: string
  authorized: boolean
  lockedGold: number
  balanceGold: number
  totalGold: number
}

export interface Signer {
  signer: string
  signature: Signature
}

export interface Signature {
  v: number
  r: string
  s: string
}

export interface AddressVotes {
  address: string
  lockedGold: number
  votes: GroupVote[]
}

export interface GroupVote {
  group: Group
  active: number
  pending: number
}

export interface Group {
  address: string
  name: string
  domain?: string
}

export interface GroupEstimatedAPY {
  group: Group
  isElected: boolean
  epochN: number
  estimatedAPY: number
}

export type ProxyGovernanceAction = "upvote" | "revoke-upvote" | "vote-yes" | "vote-no" | "vote-abstain"

export interface ProxyGovernanceMessage {
  signedAtBlock: number
  rgContract: string // if set, will proxy call on behalf of RGContract.
  proposalId: number
  action: ProxyGovernanceAction
}

export interface GovernanceProposals {
  queued: QueuedProposal[]
  voting: VotingProposal[]
}

export interface QueuedProposal {
  proposal: GovernanceProposal
  upvotes: number
}
export interface VotingProposal {
  proposal: GovernanceProposal
  votes: {
    yes: number
    no: number
    abstain: number
  }
}

export interface GovernanceProposal {
  id: number
  proposer: string
  descriptionURL: string
}

export interface EpochReward {
  timestampMs: number
  epoch: number
  asGold: number
  asUSD: number
}

export interface SavingsCELOTotalSupply {
  celoWEI: string
  sceloWEI: string
}