import React from 'react'
import Typography from '@material-ui/core/Typography'
import Logo from './logo'
import Container from '@material-ui/core/Container'
import LinkText from './link-text'
import Link from '@material-ui/core/Link'
import ViewHeadlineIcon from '@material-ui/icons/ViewHeadline'

import { electionMinVotes } from './schema'

const Faq = (props: {}) => (
  <Container maxWidth="md">
    <Logo />
    <Typography variant="h4" component="h1" gutterBottom>
      Frequently Asked Questions
    </Typography>

    <FaqQ
      id="how-does-it-work"
      text="How does Celovote work?" />
    <Typography variant="subtitle2" color="textSecondary" component="h3" gutterBottom>
      Celovote provides vote delegating service to simplify management of locked CELO tokens. Users can authorize Celovote
      service to do all vote management on their behalf. Celovote service makes sure that all locked CELO tokens for a user are
      actively voting for the high uptime validator groups. Votes are also automatically spread across multiple groups to
      provide further diversification and provide best overall returns for the user.
    </Typography>

    <FaqQ
      id="is-it-secure"
      text="Is Celovote secure?" />
    <Typography variant="subtitle2" color="textSecondary" component="h3" gutterBottom>
      Users only delegate <LinkText href="https://docs.celo.org/validator-guide/summary/detailed#authorized-vote-signers" text="voter privileges" /> to
      Celovote service, thus Celovote is only authorized to vote on behalf of the user account. Celovote does not have any access to transfer or
      withdraw tokens. To secure vote signer keys, Celovote stores them
      in <LinkText href="https://azure.microsoft.com/en-us/services/key-vault" text="Azure Key Vault" />. This provides additional protection
      for vote signer keys, since private keys are never accessed directly.
    </Typography>

    <FaqQ
      id="who-runs-celovote"
      text="Who runs/owns Celovote?" />
    <Typography variant="subtitle2" color="textSecondary" component="h3" gutterBottom>
      Celovote is run by <LinkText href="https://www.thecelo.com/group/wotrust" text="WOTrust" /> validator group. WOTrust group has been involved with Celo network
      since its beta launch and has been running validators in mainnet since genesis.
    </Typography>

    <FaqQ
      id="whats-in-it"
      text="What&apos;s in it for you?" />
    <Typography variant="subtitle2" color="textSecondary" component="h3" gutterBottom>
      WOTrust doesn&apos;t directly profit from Celovote. We benefit indirectly
      however, in two key ways:
      <ol>
      <li>We believe in the Celo ecosystem and want to encourage active participation by all CELO
        holders in vote delegation and governance. We also believe that the network will be most
        reliable if votes favor the most reliable validator groups, rather than being statically
        delegated to the wealthiest groups.</li>
      <li>We think we have the technical ability to run reliable high uptime validators.
        If we continue to maintain high uptime and receive votes as a result, it allows us to operate more validators and
        receive greater <LinkText href="https://docs.celo.org/celo-codebase/protocol/proof-of-stake/epoch-rewards/validator-rewards" text="epoch rewards" />.</li>
      </ol>
    </Typography>

    <FaqQ
      id="can-i-use-with-releasegold"
      text="Can I use Celovote with my ReleaseGold contract?" />
    <Typography variant="subtitle2" color="textSecondary" component="h3" gutterBottom>
      Yes, as long as ReleaseGold beneficiary address is stored on a hardware wallet. ReleaseGold contracts
      will automatically show up for delegation once beneficiary address is added in the app.
    </Typography>

    <FaqQ
      id="can-i-use-without-ledger"
      text="Can I delegate addresses that are not stored in a hardware wallet?" />
    <Typography variant="subtitle2" color="textSecondary" component="h3" gutterBottom>
      No. Only addresses that are stored in a <LinkText href="https://www.ledger.com" text="hardware wallet" /> can be used with Celovote.
      We take security seriously, and you should too. Hardware wallet is strongly recommended for storing tokens even if you do not
      plan on using Celovote service.
    </Typography>

    <FaqQ
      id="what-happens-with-governance"
      text={
        <React.Fragment>What happens with <LinkText href="https://docs.celo.org/celo-gold-holder-guide/voting-governance" text="Governance" /> voting
        when using Celovote service?</React.Fragment>
      } />
    <Typography variant="subtitle2" color="textSecondary" component="h3" gutterBottom>
      Celovote does not vote on any governance proposals on behalf of the user. Users are expected to participate in governance directly.
      Celovote supports upvoting and voting on governance proposals through the app. For regular accounts, users can also partipciate
      in governance by voting using their account directly. For ReleaseGold contracts, voting wth the Celovote app is the only available
      option. Learn more about participating in Governance using Celovote in this <LinkText
        href="https://wotrust.us/posts/celovote-governance/"
        text="blog post" />.
    </Typography>

    <FaqQ
      id="how-much-does-it-cost"
      text="How much does it cost to use Celovote service?" />
    <Typography variant="subtitle2" color="textSecondary" component="h3" gutterBottom>
      Celovote is free to use and does not charge any fees or commission. Note that if you authorize Celovote for ReleaseGold
      contract, contract will automatically transfer 1 CELO to the service. This is ReleaseGold contract behaviour and not a fee
      that Celovote charges. If you want to avoid sending that 1 CELO to Celovote, you can authorize some other vote
      signer first, before authorizing Celovote for your ReleaseGold contract.
    </Typography>

    <FaqQ
      id="how-does-it-vote"
      text="How does Celovote choose validator groups to delegate votes to?" />
    <Typography variant="subtitle2" color="textSecondary" component="h3" gutterBottom>
      Celovote only votes for groups that pass high <LinkText href="/scores" text="estimated APY" /> (annual percentage yield)
      threshold. Majority of the votes are distributed to few preferred groups out of that list, and rest are distributed
      to few random groups with the highest estimated APY.
      <br />
      <br />
      To provide good diversification, Celovote will cast votes for up to 10 groups (or 20 elected validators). This
      ensures that even if a single validator has some uptime issues in an epoch, total rewards don&apos;t get affected significantly.
      Celovote does not vote for any groups or validators that have active slashing penalites.
      <br />
      <br />
      The list of preferred groups are pre-defined manually. With current
      configuration, <LinkText href="https://www.thecelo.com/group/wotrust" text="WOTrust" /> group gets 50% of the votes until it receives enough
      votes to elect 1 validator. After that, its vote share decreases linearly and overall Celovote vote distribution becomes
      more equal among all high estimated APY groups. Logic behind this setup is that we believe votes for electing ~1-2 validators
      are fair compensation for running the Celovote service. And as Celovote gains more traction, it makes sense to
      diversify votes further, to support network decentralization in addition to providing best returns for
      Celovote users. Required votes for electing a single validator is configured as: <code>{electionMinVotes.div(1e18).toString()}</code>
      <br />
      <br />
      The specfic criterias for choosing groups might change in future, however the first priority will always
      remain to provide highest returns on locked CELO for the users.
    </Typography>

    <FaqQ
      id="how-do-i-stop"
      text="How do I stop using Celovote service?" />
    <Typography variant="subtitle2" color="textSecondary" component="h3" gutterBottom>
      To stop using the service, simply authorize other vote signers for your accounts or ReleaseGold
      contracts. That way, Celovote will automatically lose access to delegate your votes. If you change
      your mind, you can always come back and re-authorize with Celovote to automatically delegate your
      votes once again.
    </Typography>

    <Typography variant="body1" color="textPrimary" component="h2" style={{marginTop: 50}}>
      For further questions checkout <code>#celo-holders</code> channel
      in Celo <LinkText href="https://discord.com/channels/600834479145353243/600839784700837926" text="Discord" />. You can also
      reach out to us directly at: <LinkText href="mailto:support@celovote.com" text="support@celovote.com" />.
    </Typography>
  </Container>
)

const FaqQ = (props: {id: string, text: string | JSX.Element}) => (
  <Typography id={props.id} variant="h6" color="textSecondary" component="h2" gutterBottom style={{paddingTop: 10}}>
    <Link href={`/faq#${props.id}`}>
      <ViewHeadlineIcon style={{verticalAlign: "middle", paddingRight: 5, paddingBottom: 5}} /></Link>
    {props.text}
  </Typography>
)

export default Faq
