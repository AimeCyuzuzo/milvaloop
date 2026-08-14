# MilvaLoop — Platform Brainstorming

An exploration of the *idea*, not the implementation. This document evaluates the
product concept for MilvaLoop against the real market, the real law, and the real
behaviour of cooperatives. It deliberately contains no architecture, no schema and
no technology choices.

**Status:** working document. First draft written 2026-08-12; revised the same day
with a second research pass that resolved most of the gaps flagged in the first
draft (data protection and hosting, financial-regulation thresholds, the exact
surplus-distribution law, and IFRIC 2's accounting treatment of member shares — see
§3.9–§3.11). §12 lists what is still genuinely open.
**Source of the concept:** the author's original specification (80 sections),
summarised and preserved separately for analysis.

---

## 0. How to read this document

Findings are marked by how much weight they can carry:

| Mark | Meaning |
|---|---|
| **[verified]** | Taken from a primary source that was retrieved and read directly — the law text itself, official government pages, vendor documentation. Cited in §13. |
| **[reported]** | From a credible secondary source (news, industry write-up, vendor marketing). Directionally reliable, details may drift. |
| **[analysis]** | Reasoning, not research. My argument from the spec and the domain. Argue with it freely. |
| **[unresearched]** | Named as a known gap. Listed in §12 so nothing important is silently skipped. |

The single most important section is **§3 — the law**, because several provisions
of Rwanda's current cooperative law contradict the spec's central mechanic. Read
that before anything else.

---

## 1. The idea, restated plainly

Strip away the 80 sections and MilvaLoop is one claim:

> A cooperative should not need a particular human being to remember how its
> records became what they are.

Everything else — the audit trail, the event model, the approval workflows, the
"explain this record" surfaces — is machinery in service of that claim. The
product's proposed differentiator is not features but *reconstructability*: any
number on screen can be traced back through the events that produced it.

That is a genuinely good product thesis. It is also, as written, **an unusually
disciplined piece of domain thinking** — the spec's insistence that

```
Contribution ≠ Allocation ≠ Obligation ≠ Share ownership ≠ Compliance
```

is the kind of separation most teams discover two years and one painful migration
too late. **[analysis]**

The rest of this document is about the distance between that thesis and a
shippable, legal, sellable product.

---

## 2. What already exists

### 2.1 The Rwandan market is not empty

This is the finding that most changes the picture.

**COPA (copa.rw)** is an existing Rwandan platform describing itself as
"infrastructure for cooperatives and every member-driven organization" and as "the
operating system for the membership economy — cooperatives, SACCOs, savings groups,
associations, unions, alumni networks, and religious organizations". It states it is
built for Rwanda's **12,000 cooperatives and 5.5 million members across 30
districts**. It manages cooperatives, members, financial data (savings, loans,
payment records) and production data (agricultural and business records), and offers
automated reporting, SMS notifications, cloud storage and a mobile-friendly
interface. It has public API documentation and an Android app. **[verified]**

Two observations. First, "cooperative operating system" is *already someone else's
positioning line* — §3 of the spec proposes almost exactly that phrase. Second, and
more usefully: COPA's own API documentation exposes cooperatives, members, financial
data and production data — but **does not expose shares or contributions as
first-class entities**. **[verified]** That is precisely the gap MilvaLoop's domain
model is built around. The incumbent is broad and shallow where MilvaLoop proposes to
be narrow and deep. That is a real, defensible wedge — but it must be chosen
deliberately, not stumbled into. **[analysis]**

**RCA runs CMIS** (Cooperative Management Information System) for cooperative
registration; applicants register online, sector and district officers review, RCA
grants legal personality. **[verified]** Any product serving Rwandan cooperatives
sits *downstream* of CMIS, not instead of it.

### 2.2 The SACCO segment is already taken — by the government

All **416 Umurenge SACCOs were automated**, completed June 2024, at 100% coverage.
They were then consolidated into **30 district-level SACCOs** running a **shared core
banking system** built by Rwandan developers with RISA and MINECOFIN, with internet
banking and a mobile app scheduled for December 2026, and a Cooperative Bank being
established as the apex institution. **[reported]** Reported cost across phases runs
into the billions of RWF (a 2015 contract at ~USD 4.6M / RWF 4bn; RWF 5.7bn for
consultants and equipment; RWF 7.6bn to complete; phase one reported at over USD
10M). **[reported]**

**Implication:** Umurenge SACCOs are not a market. They are a state-run, state-funded,
state-integrated system. MilvaLoop's addressable market is what is *left*:
non-financial cooperatives, private and informal savings groups, associations, and
member-driven organisations that fall outside both the U-SACCO programme and BNR
supervision. **[analysis]**

### 2.3 Regional and global vendors

Named vendors marketing SACCO/cooperative software into East Africa include PayStar
Africa, Finhazi, Softeye Solutions (SACCO360), Saccowave (Uganda), Coretec ("70+
SACCOs"), and Mfuko Plus (Uganda). **[reported]**

The most useful pricing anchor found: **Kwara** (Kenya, founded 2018, Nairobi and
Berlin, serving 230+ SACCOs, AWS-hosted) publishes Premium pricing **starting at
30,000 KES per month** — roughly USD 230 — with custom Enterprise pricing, on a fixed
subscription covering unlimited user licences and member accounts. **[verified]**

Set against MilvaLoop's current placeholder of **USD 39/month**, that is a ~6×
gap. The two are not the same product for the same buyer — Kwara is core banking for
regulated SACCOs — but it establishes that the ceiling in this region is far above
USD 39 for organisations that actually run money. **[analysis]**

### 2.4 The open-source comparison that matters most

**Apache Fineract** (and Mifos X above it) has a mature share-account model, and it
independently arrived at several of the same conclusions as the spec — which is
strong validation — plus one concept the spec is missing.

Fineract share products define: unit/nominal price, "multiples of", total shares,
**a suspense account**, and an equity account. When a member applies for shares, the
purchase price is **held in a suspense account** until the application is approved.
Share quantities are whole numbers only — **no fractional shares**. Configuration
includes **minimum, default and maximum shares per client**, **market pricing with
effective dates**, lock-in periods, and a minimum active period for dividend
eligibility. Share accounts support approve, activate, **buy more shares, redeem
some**, and close. **[verified]**

Read that against the spec:

| Spec's position | Fineract | Verdict |
|---|---|---|
| Whole shares only (§6.2) | Whole shares only | **Validated** |
| Effective-dated share value (§41) | Market pricing with dates | **Validated** |
| Configurable share rules (§40) | Min/default/max shares per client | **Validated**, and see §3.2 — the max is legally required in Rwanda |
| *(no concept)* | **Suspense account** for money received but not yet converted to shares | **Gap in the spec** — see §5.1 |
| *(no concept)* | Share **redemption** | **Gap in the spec** — and legally mandatory, see §3.4 |
| *(no concept)* | Dividend eligibility rules | **Gap in the spec** — and legally mandatory, see §3.5 |

The honest question this raises: **should MilvaLoop build its own domain model at
all, or adopt Fineract?** My answer is build — but for a specific reason. Fineract is
a core banking system; its centre of gravity is accounts, products and transactions.
MilvaLoop's thesis is explanation and governance, which Fineract does not do. Adopting
Fineract would buy a correct financial model and inherit a product shape that fights
the actual differentiator. But the spec should *steal freely* from Fineract's model,
starting with the suspense concept. **[analysis]**

---

## 3. The law — and where it breaks the spec

Rwanda's governing statute is **Law n° 057/2024 of 20/06/2024 governing cooperatives
in Rwanda**, published in *Official Gazette n° 28 Bis of 08/07/2024*. It repeals Law
n° 024/2021, which had itself replaced the 2007 law. **[verified — read directly from
the gazette text]** The Rwanda Cooperative Agency is established by Law n° 48/2013.
**[verified]**

Everything in this section is quoted or closely paraphrased from that gazette text.

### 3.1 A member may not hold more than ten shares — and this breaks the core mechanic

> **Article 60(1):** "A member holds one or several shares. However, he or she cannot
> hold shares whose value is more than ten times the nominal value of the share."
> **[verified]**

This is the most consequential finding in this document.

The spec's central mechanic is **one share per month, every month, forever** (§7:
"A member is expected to contribute at least one whole share every month"). Under
Article 60(1), a member reaches the legal ceiling in **ten months**. The spec's own
worked examples — "Alice owns 7 shares" (§56), "someone can have 20 shares" (§8.4) —
sit at or beyond the limit; the 20-share example is not legal in a Rwandan
cooperative.

For financial service cooperatives the constraint is different but still binding: a
member may hold shares worth **no more than 0.05% of total paid-up capital**
(Article 60(2)). **[verified]**

The conclusion is not "adjust a validation rule". It is structural: **the recurring
monthly money that MilvaLoop is built to track cannot mostly be share purchase.**
After ten months it legally cannot be. So what is it? The law answers directly.

(One piece of context on the cap itself: the 10× ceiling in the 2024 law is actually
an *increase* from a 5× ceiling under the prior regime. **[reported]** That the
legislature deliberately doubled it and still capped it is a signal that unlimited
share accumulation was consciously rejected, not merely an oversight — worth knowing
if there is ever a temptation to treat the cap as a technicality to design around.)

A separate, smaller data point worth recording here: a primary cooperative requires
**at least ten founding members** (five for a cooperative of persons with
disabilities) to be established (Article 9). **[verified]** This sets a floor on how
small a real customer can be.

### 3.2 The law already separates money types — along a different axis than the spec

The statute distinguishes at least four distinct kinds of member money:

| Legal concept | Article | Nature |
|---|---|---|
| **Share capital** | 58–64 | Subscribed and paid-up shares. Capped at 10× nominal per member. Indivisible, non-negotiable, protected. |
| **Regular contribution** | 94(1) | For running costs, **approved by the General Assembly**, tied to the annual action plan. |
| **Irregular contribution** | 94(1) | For unplanned, urgent activity — requires **RCA approval**. |
| **Payment for services** | 94(2) | A member paying for a specific service the cooperative provided. |
| **Member deposits** | 100 | "A non-financial cooperative may only receive deposits from its members." |

**[verified]**

The spec models exactly one money type — a monthly obligation satisfied by
contributions, producing shares — and treats it as the whole world. The law says a
cooperative routinely handles four or five kinds of member money with *different
approval authorities, different refundability, and different rights attached*.

This is the sharpest critique in this document, and it is a friendly one: **the spec's
five-way separation is correct and valuable, but it is a decomposition of one money
type. The product needs a second axis — money *kind* — crossed with the mechanical
axis it already has.** A contribution should carry a kind (share capital / regular
contribution / irregular contribution / deposit / service payment / fine), and that
kind should determine what it can be allocated to, whether it is refundable on exit,
whether it confers shares, and who must approve it. **[analysis]**

That single change probably has a larger effect on the product's real-world
correctness than everything else in this document combined.

### 3.3 Voting: one member one vote, no proxy, in person

> **Article 62:** "Each member of a cooperative has only one vote which is equal to
> that of his or her peers."
>
> **Article 35(2):** "A member of a cooperative or a representative of a member has
> one vote and **votes in person and cannot vote by proxy**."
>
> **Article 35(1):** The General Assembly "votes by show of hands or by any other
> method agreed upon by the members."
>
> **Article 35(3):** "The decision of the General Assembly is taken by an **absolute
> majority of votes cast**. In case of a tie, a new vote is taken." Amendments to
> bylaws, forming a union/federation/confederation, merger, transformation into a
> company, and dissolution require a meeting attended by at least **three-quarters of
> members**. **[verified]**

This settles several of the spec's own open questions in §73:

- *"Can vote weight depend on shares?"* — **No.** Article 62 forbids it. Do not build
  weighted voting for Rwandan cooperatives; if it is built for other jurisdictions,
  it must be off and unavailable by default.
- *"What is the approval threshold?"* — The statutory default is **absolute majority
  of votes cast**, with a **three-quarters attendance** requirement for constitutional
  matters. The spec's configurable thresholds are right, but the shipped defaults
  should be the legal ones, not "simple majority".
- *"Are abstentions counted?"* — "Votes cast" is the operative phrase; the product
  should show its arithmetic explicitly rather than assume.
- *"Secret or visible?"* — The default is a show of hands, i.e. **visible**, with any
  other method permitted if members agree. The spec's design (individual votes
  recorded and visible to authorised users) is consistent with the law.

The genuinely hard one: **Article 35(2) says members vote *in person* and may not vote
by proxy.** **[verified]** A platform that runs asynchronous remote voting for General
Assembly decisions is in uncertain territory. This does not mean the voting module is
worthless — it is clearly fine for committee polls, loan committee decisions,
non-binding consultation, and *recording* votes that happened in a physical meeting.
But MilvaLoop should be careful never to market itself as replacing in-person General
Assembly voting until a lawyer confirms the position. **[analysis]** Flagged as a
policy question in §9.

Article 35(1)'s "any other method agreed upon by the members" may be the opening
that makes electronic voting workable — but that is exactly the kind of question that
needs a Rwandan legal opinion, not a product decision. **[unresearched]**

### 3.4 Exit and refund is mandatory — and the spec has nothing

> **Article 92(1):** "A member who is expelled or decides to withdraw from membership
> in the cooperative is entitled to a refund of the value of his or her paid-up share
> together with all unpaid dividends and bonuses. However, in case the total equity of
> a cooperative is less than the total value of the paid-up capital, the former member
> is refunded his or her share minus the loss incurred by the cooperative when he or
> she was still a member and the debt he or she owes to the cooperative."
>
> **Article 63:** A cooperative "has a first charge upon the property to which a
> withdrawing or expelled member is entitled" to cover debts owed; if insufficient,
> the member has up to **one year** to pay the remainder. **[verified]**

The spec mentions member exit only as an edge case to handle "eventually" (§72) and
an open policy question (§73). In fact this is a **mandatory, formula-driven
computation** the system must be able to perform and explain:

```
refund = paid-up share value
       + unpaid dividends
       + unpaid bonuses
       − share of losses incurred while a member       (if equity < paid-up capital)
       − debts owed to the cooperative                  (Art 63 first charge)
```

This is, incidentally, *the perfect showcase for MilvaLoop's explainability thesis*.
"Why is my exit refund 340,000 RWF and not 500,000?" is exactly the question that
destroys trust in a cooperative and exactly the question the product claims to answer.
Exit settlement should arguably be a **headline feature, not an edge case**. **[analysis]**

### 3.5 Surplus, reserves, dividends and bonuses are annual and mandatory

> **Article 95:** A cooperative deriving a surplus **must retain part of it as general
> reserves**; dividends may **not** be paid from general reserves; a member has **no
> right to claim any specific share of general reserves except on dissolution**.
>
> **Article 96:** The National Agency issues regulations governing the training fund.
>
> **Article 98(4):** Dividends go to those who were members **for the full financial
> year** in which the profit was generated.
>
> **Article 99:** A bonus (*ristourne*, i.e. patronage refund) is determined by the
> member's **contribution to the profit**; bylaws set the distribution method.
> **[verified]**

**Article 97, read directly from the gazette, resolves a conflict left open in an
earlier draft of this document** (RCA's own public summary of the new law said "at
least 50%" to dividends **[reported]**; a separate secondary summary of the draft law
said "at least 70%" **[reported]**). The statute itself is unambiguous:

> **Article 97(1):** "In case a cooperative makes profit, the net surplus is
> distributed not later than the **31st of March** of each year, as follows: (a) at
> least **seventy percent (70%)** of the net surplus is assigned as dividend to
> members; (b) the remaining net surplus is distributed as follows: (i) an amount of
> not more than **fifty percent (50%) of that remainder** is deposited into the
> general reserve; (ii) the remaining fifty percent of that remainder is used for
> activities of the cooperative approved by the General Assembly, including bonuses to
> members, incentive bonuses to the Board of Directors, the Supervisory Committee and
> employees, training, and other activities." **[verified]**

So, as a share of total net surplus: **at least 70% to members as dividends, up to
15% to general reserves, up to 15% to Board-approved activities/bonuses** — not the
"50/10/10/30" figure some secondary sources report. The gazette text is authoritative;
treat any product feature or marketing claim that cites a percentage against this law
as needing to match Article 97 exactly, not a summarised version of it.

An annual surplus-distribution cycle with a **hard 31 March deadline** is mandatory and
entirely absent from the spec. It touches share capital (dividends may be capitalised
into shares under Article 59(c)), member records (the full-year membership test in
Article 98(4)), and the audit trail — and it is a concrete, dated, recurring event the
product could actively help a cooperative not miss.

### 3.6 Shares cannot be collateral — and pledging them is a crime

> **Article 64:** "A share owned by a member in a cooperative is protected, **cannot be
> given as a security or be subject to seizure** and remains **indivisible and
> non-negotiable**. However, it may be transferred or sold to another person upon
> approval by the General Assembly." **[verified]**

RCA's summary of the new law states that pledging shares as collateral carries **6
months to 2 years imprisonment plus a fine of 2–3 times the pledged share value**, and
that fraudulent use of cooperative property carries 2–5 years plus RWF 500,000–5,000,000.
**[reported]**

Consequences for the loan module:

- **Never** offer "secure this loan against your shares". It is criminal.
- Guarantors (which the spec already has, §21.1) are the correct mechanism, together
  with the Article 63 first charge on exit.
- "Indivisible" is direct legal support for the spec's whole-share rule (§6.2) — the
  instinct was right, for a reason the spec did not know.
- Share *transfer* between members exists and requires **General Assembly approval** —
  a governance workflow the spec does not model.

### 3.7 The law explicitly blesses electronic records — and imposes ten-year retention

> **Article 82(1):** A cooperative keeps at its head office, **for at least ten years**
> from the end of the year in which they were created: "a register **or electronic
> system** containing minutes of the meetings of cooperative governance organs"; and a
> register or electronic system containing legal documents (the law, bylaws, code of
> conduct, internal rules, and others).
>
> **Article 83:** A cooperative keeps "books of accounts **or electronic system**
> prepared in accordance with the **generally accepted international accounting
> standards**", and the records must reflect money received and the reasons for it,
> amounts spent and the reasons, sales/purchases/other transactions, and assets and
> liabilities. **[verified]**

Two things follow.

**The good news:** the law explicitly contemplates an electronic system in place of
paper registers, for both minutes and books of account. MilvaLoop is not fighting the
statute; it is an anticipated form of compliance. The ten-year retention requirement
is also a genuine commercial argument — "your records must survive ten years; a
spreadsheet on the former treasurer's laptop will not". **[analysis]**

**The uncomfortable news:** Article 83 requires accounting to *international
standards*, reflecting assets and liabilities. The spec defers a real transaction
ledger, expenses, income and accounts to **Phase 4** (§68). Until that exists,
MilvaLoop does not discharge the cooperative's statutory accounting duty — it sits
*alongside* accounting, not instead of it. That is a perfectly fine product position,
but it must be stated honestly in marketing, and it caps how much of the customer's
problem is being solved. **[analysis]**

Ten-year retention also creates obligations the spec has not considered: what happens
to a cooperative's records when it stops paying? Deleting them may put the customer in
breach. Export-on-exit is not a nice-to-have; it is close to a duty of care. **[analysis]**

### 3.8 Other provisions worth knowing

- **Article 61:** A member "cannot be entitled to or exercise any of the rights of a
  member" until their share is paid up. **[verified]** Membership rights — including
  voting — are *conditional on share payment*. The spec has no notion of a member
  whose rights are suspended for non-payment, though it does have compliance status.
  These are related but not the same thing, and conflating them would be a mistake.
- **Article 60(3):** A share "is paid either **in kind** or money." **[verified]** For
  agricultural cooperatives especially, contribution in kind is real. The spec assumes
  money throughout.
- **Article 60(5):** Share value is "certified by a receipt of acknowledgment issued
  for the sum paid" and inscribed in the member's personal name. **[verified]** The
  spec's receipt/evidence handling (§31.2) aligns well; issuing the acknowledgment
  could be a product feature rather than a paper step.
- **Article 100:** A non-financial cooperative "may only receive deposits from its
  members". **[verified]**
- RCA can **provisionally suspend** cooperative leaders and employees for asset
  mismanagement, **blacklist** convicted individuals from cooperative leadership, and
  appoint temporary management. Legal personality processing has been reduced from 35
  days to 2. **[reported]**

### 3.9 Data protection — this constrains where MilvaLoop can host, right now

This is separate from the cooperative law, and it is the single most operationally
urgent finding in this document, because it applies **today**, to the current
Vercel-hosted stack, regardless of which product decisions come later.

**Law n° 058/2021 relating to the protection of personal data and privacy**, in force
since 15 October 2021, applies to any controller or processor handling the data of
people located in Rwanda — **including entities with no physical presence in Rwanda**,
a broader extraterritorial reach than GDPR (which limits itself to offering
goods/services or monitoring behaviour in-scope; the Rwandan law does not carry that
limitation). **[reported]**

The provisions that matter most for MilvaLoop:

- **Data localisation by default.** "Article 50 requires all personal data to be
  stored in Rwanda except for registered entities with NCSA-issued certificates to
  store data abroad." **[reported]** MilvaLoop's data — member names, contact details,
  contributions, share ownership, loan records — is squarely personal (and financial)
  data. Hosting on Vercel's infrastructure, which does not offer a Rwanda region, is
  offshore storage and requires this certificate; it is not automatically compliant
  because the company is Rwandan.
- **Cross-border transfer restrictions.** "Article 48 bars data being transferred to
  third parties unless they are authorized by the National Cyber Security Authority
  (NCSA)." A valid registration certificate is required to authorise transfer of
  personal data outside Rwanda. **[reported]**
- **Mandatory registration, but no fee.** Controllers and processors must register
  with the NCSA; there is no registration fee. **[reported]** New controllers/processors
  must comply immediately; those already processing data had until 14 October 2023.
  **[reported]** The NCSA is required to issue a registration certificate within 30
  days of a complete application. **[reported]**
- **Penalties are real, not nominal.** Operating without registration is an
  administrative offence carrying a fine of **RWF 2,000,000–5,000,000**, or **1% of
  global turnover** for a corporate body, plus possible imprisonment up to 10 years and
  cancellation of the certificate (which in effect prohibits further processing).
  Knowingly providing false information during registration carries **1–3 years'
  imprisonment and a RWF 3,000,000–5,000,000 fine**. **[reported]**
- **Breach notification is fast.** Controllers must notify the regulator within **48
  hours** of becoming aware of a breach and file a full report within **72 hours**;
  data subjects must be informed where the breach poses high risk to their rights.
  **[reported]**
- **A Data Protection Officer is conditionally required** — mandatory where core
  activity involves regular, systematic, large-scale monitoring of data subjects, or
  processing of sensitive data; not universally mandatory for every controller.
  **[reported]**

**What this means concretely:** before MilvaLoop takes on a single real cooperative's
member data, it needs (a) NCSA registration as a data controller/processor — free, and
apparently fast once the application is complete — and (b) a resolved position on
hosting: either move the data layer to infrastructure with a Rwanda presence, or obtain
the NCSA offshore-storage certificate that Article 50 requires for staying on Vercel's
(or any foreign) infrastructure. This is not a "someday" compliance task; it is a
precondition for onboarding, and it should be resolved before the pilot in §10, not
after. **[analysis]**

### 3.10 Financial regulation — where the compliance line actually sits

The **National Bank of Rwanda (BNR)** supervises deposit-taking microfinance
institutions (DTMFIs), a category that explicitly includes SACCOs. As of December
2024, Rwanda had **434 licensed DTMFIs: 22 public limited companies and 412 SACCOs.**
**[reported]** Under Regulation n° 57/2023, licensing as a DTMFI requires **minimum
paid-up capital of RWF 1 billion for microfinance companies and RWF 100 million for
cooperatives (SACCOs)**, with transitional provisions giving existing institutions up
to five years to comply. **[reported]** Consumer-protection rules attach real
penalties even at the SACCO level — e.g. a **RWF 50,000 per-violation fine** for SACCOs
failing to provide a key-facts statement before account opening. **[reported]**

Separately, BNR licenses **Non-Deposit-taking Financial Institutions (NDFIs)** —
lenders that extend credit but do not collect deposits from the public — with a lower
capital bar (RWF 50,000,000 for a non-deposit-taking lending company). **[reported]**
This category is aimed at standalone lending businesses (including digital lenders),
not at a cooperative lending only to its own members from its own members'
contributions.

Two things follow. First, **the RWF 100 million paid-up capital threshold is a real,
identifiable line**: a cooperative below it that only handles its own members' share
capital and internal loans is very unlikely to be a BNR-licensed institution and stays
under RCA's ordinary (non-financial) cooperative supervision — RCA itself formally
separates "Non-Financial Cooperatives Supervision" from SACCO/financial-service
cooperative oversight. **[verified — RCA's own site structure, cited in §2.1]** Second,
the law explicitly recognises informal member-lending groups as their own category
outside this regulatory perimeter: **"tontines are schemes through which a group of
individuals contribute sums of money to make collective savings and lend money to one
another among themselves on such terms as agreed upon among themselves"** — i.e.
informal group lending is a named, understood, and by implication lighter-touch
activity distinct from licensed deposit-taking. **[reported]**

**Practical read for MilvaLoop:** the realistic customer base — small non-financial
cooperatives and informal-to-semi-formal savings groups collecting member
contributions and lending internally, well under RWF 100M in paid-up capital — sits
outside BNR's licensing perimeter and is governed by the cooperative law (§3) rather
than banking regulation. That is good news for go-to-market: it is the segment §2.2
already identified as available. But it means the product should treat "are we now
serving a licensed SACCO?" as a real state a cooperative can cross into, since the
compliance posture changes materially at that point — and neither MilvaLoop nor
MilvaLabs should assume the answer is always no. **[analysis]** Whether a
*software vendor itself* carries any registration duty toward BNR (as distinct from
the cooperative customer) was not found in this research and should be confirmed with
a Rwandan financial-regulation lawyer before serving a licensed SACCO. **[unresearched]**

### 3.11 Accounting: member shares are very likely a liability, not equity

**IFRIC 2** ("Members' Shares in Co-operative Entities and Similar Instruments")
governs how IAS 32 classifies member shares. The rule: if a member has the right to
request redemption, the cooperative **normally classifies those shares as a
liability**, unless the entity has an unconditional right to refuse redemption, or law
or the governing charter currently prohibits redemption. Where shares are classified
as a liability, they are measured at **the maximum amount payable under the
redemption provisions of the governing charter or applicable law**. A change in the
level of a redemption prohibition triggers a transfer between liability and equity.
**[reported]**

Cross-reference this against §3.4: **Article 92 gives every withdrawing or expelled
member an unconditional right to a refund** of their paid-up share (net of losses and
debts). There is no cooperative-level right to refuse redemption. Under IFRIC 2's own
test, this points toward **member shares in a Rwandan cooperative being a financial
liability in its accounts, not equity** — the opposite of how "share capital" instinctively
reads, and the opposite of how the spec's language ("share ownership", §8.3) frames it.

This does not have to be a problem for MilvaLoop specifically — the product does not
need to produce IFRS statements itself (see §3.7's point that full accounting is
deferred to Phase 4) — but it is a real trap for whoever *does* produce the
cooperative's statutory accounts (Article 83 requires "generally accepted
international accounting standards"). If MilvaLoop's data model calls something
"equity" or presents share totals the way an owner's-equity account would, and the
cooperative's actual accountant is booking those same shares as a liability under
IFRIC 2, the two records will not reconcile, and the dispute will look exactly like
the kind of trust-destroying discrepancy the product exists to prevent. **[analysis]**
Recommendation: keep the data model's own vocabulary (contribution, allocation,
share ownership, obligation) deliberately distinct from accounting terms like "equity"
so it never implicitly asserts a classification that belongs to the cooperative's
accountant to make.

---

## 4. What the spec gets right

Worth stating plainly, because the critique sections are longer and it would be easy
to read this document as negative. It is not. **[analysis]**

1. **The five-way separation is the right core idea.** Contribution / allocation /
   obligation / share ownership / compliance. Most systems in this space conflate at
   least two of these and never recover. The lump-sum-versus-extra-shares distinction
   (§7.2, Case A vs Case B) is a genuinely subtle insight that most teams get wrong.
2. **Claims versus confirmations (§4.5, §11).** Letting a member assert a payment
   without that assertion becoming truth is exactly right, and it is the mechanism
   that makes member self-service safe.
3. **Corrections and reversals instead of edits (§28.2, §42, §43).** Correct, and
   corroborated by every serious financial system.
4. **Effective-dated share definitions (§41).** Right, and independently validated by
   Fineract's "market pricing with dates". **[verified]**
5. **Whole shares (§6.2).** Right, and now backed by Article 64's "indivisible".
6. **Derived totals must be recomputable (§48).** The refusal to have a single
   editable "current balance" field is the difference between a system that can
   explain itself and one that cannot.
7. **Explanation as a core product characteristic, not a reporting feature (§3.4).**
   This is the actual differentiator and the spec is right to elevate it.
8. **The refusal to build a bank (§69).** Correct instinct, and §2.2 shows why: that
   space is occupied.
9. **The vocabulary discipline (§79).** Underrated. Most products in this domain rot
   because "contribution" means four things by month six.
10. **The explicit acknowledgement that legal validation is outstanding (§74).** The
    spec knew what it did not know. §3 of this document is the answer to that section.

---

## 5. What is wrong or risky

### 5.1 There is no home for unallocated money

The spec has contributions and allocations but never names the state *in between*.
Where does 30,000 RWF live when it has been received and approved but the obligation
it is meant to satisfy needs 50,000?

The spec's answer (§9.3, §15) is that it sits as a partial allocation *against the
obligation*. That works until reality intervenes:

- The member leaves before completing the share. What is refunded?
- The obligation is waived (§16) after 30,000 was allocated to it. Where does the
  30,000 go?
- The share value changes (§41) between the 30,000 and the 20,000. Which value applies?
- Money arrives with no obligation to attach it to — a member pays before the period
  exists (§72 lists this as an edge case, with no answer).
- A contribution is reversed (§43) *after* its allocation completed a share. Is the
  share destroyed? Can it be, if a dividend has already been paid on it?

Fineract's answer is a **suspense account**: money received sits in suspense until the
event that converts it into shares. **[verified]** MilvaLoop needs an equivalent
first-class concept — unallocated member balance — with its own rules for refund,
carry-forward and reallocation. Without it, every one of the above cases becomes an
ad-hoc decision made differently by different administrators, which is precisely the
disease the product exists to cure. **[analysis]**

### 5.2 The monthly-share mechanic cannot survive Article 60

Covered in §3.1. Restated as a product problem: the spec's single most-repeated
example — one 50,000 RWF share per month, forever — is legally impossible after ten
months. Every worked example in §9, §53, §76 inherits this. The fix is §3.2's second
axis (money kind), and it is not cosmetic. **[analysis]**

### 5.3 The audit trail's guarantee is weaker than the spec implies

§28 calls the audit trail "immutable or strongly protected" and §75 says the whole
value proposition is that no human needs to remember how records became what they are.
But MilvaLabs operates the database. A system administrator can, in principle, alter
history.

So: **immutable to whom?** For the intended benefit — a member who suspects the
treasurer, or an external auditor under Article 114 — "immutable" must mean something
stronger than "the application does not expose an edit button". Options worth
considering: hash-chained event records, periodic signed exports the cooperative holds
itself, exports the auditor can verify independently, or publishing a periodic digest.
None of these is expensive; all of them convert a marketing claim into a real one.
**[analysis]**

There is also a governance question the spec never asks: **what happens when the
cooperative's own leadership is the bad actor?** Every control in the spec is
administered by roles that leadership controls. A product whose pitch is transparency
should have at least one answer here — an unalterable member-visible record, or an
auditor role that leadership cannot revoke. **[analysis]**

### 5.4 Configurable separation of duties will be switched off

§39 makes separation of duties configurable, and §4.6 makes almost everything
configurable. In a cooperative with three active officers, mandatory separation is
inconvenient, so it will be disabled, and the control that mattered most will be the
first to go. **[analysis]**

Recommendation: make a small number of separations **non-negotiable** — most
importantly, the person who records a contribution should not be able to be the sole
approver of it — and let everything else be configured. A product that permits its own
core control to be disabled cannot honestly market itself on integrity.

### 5.5 Configurability is being used to avoid deciding

Related but distinct. §40 makes share value, minimum shares, due dates, grace periods,
approval rules, voting thresholds, loan limits and reminder schedules all configurable,
and §73 lists roughly thirty policy questions as "to be decided by the cooperative".

Some of that is correct — cooperatives genuinely differ. But a large configuration
surface is the most reliable way to (a) make onboarding so hard nobody completes it,
and (b) generate combinations nobody has tested. And §3 shows that many of these
"policy questions" are **not actually open** in Rwanda: one-member-one-vote is law,
the 10× share cap is law, absolute majority is the default, three-quarters attendance
for constitutional matters is law. **[analysis]**

Recommendation: ship **opinionated legal defaults for Rwanda**, and treat every
configuration option as something that must earn its existence by a real customer
needing it.

### 5.6 The transparency default may be wrong for a cooperative

§27.2 restricts members from seeing other members' detailed contribution history.
That is a sensible privacy instinct imported from ordinary SaaS. But a cooperative is
not an ordinary organisation: members are co-owners with governance rights, and in
many real groups the register of who has paid is *deliberately public* precisely
because visibility is the enforcement mechanism.

The right answer is likely a cooperative-level decision with a legally-aware default,
not a fixed product opinion — but the spec should recognise the question exists.
Getting it wrong in either direction is damaging: too open is a privacy problem under
Rwanda's data protection law; too closed removes the peer accountability the group
already relies on. **[analysis]** **[unresearched — the data protection analysis was
not completed, see §12]**

### 5.7 Automated reminders in a small community are a social instrument

§18 proposes automated upcoming, partial and overdue reminders, with wording
configurable. In a 30-person cooperative where everyone knows everyone, an automated
"you are 20,000 RWF short" is not a neutral notification — it is a social act, and if
it is ever visible to others, it is public shaming at scale, executed by software with
no judgement about illness, bereavement or hardship. The spec has waivers (§16), which
helps, but reminders fire from obligation status, and waivers require someone to have
already acted. **[analysis]**

Worth designing deliberately: a quiet period, an easy "pause reminders for this
member" that does not require a formal waiver, and a firm rule that overdue status is
never exposed to other members automatically.

### 5.8 Phase 1 is too large to ship

§68's Phase 1 is authentication, cooperative setup, member management, roles and
permissions, share configuration, monthly obligations, contributions, approvals,
allocation, share ownership, audit trail, notifications, a member dashboard and an
administrator dashboard. That is not a first release; that is a year. **[analysis]**

A defensible first release, in my view:

1. Members (add, edit, list, status)
2. **One** money kind, correctly modelled, with obligations and allocations
3. Record a contribution (administrator only — defer member claims)
4. One approval step
5. Audit trail
6. "Explain this" on exactly two surfaces: a member's balance, and a member's period status

No roles matrix (one administrator role plus member), no notifications, no dashboards
beyond a work queue, no configuration UI (values set at setup). Everything else waits
for a real cooperative to ask.

The reasoning: the differentiator is explanation. A tiny product that explains one
number perfectly proves the thesis. A large product that explains nothing yet proves
nothing and cannot be finished. **[analysis]**

---

## 6. What is missing entirely

Ranked by how much damage the absence causes.

### 6.1 Critical

| Missing | Why it matters |
|---|---|
| **Money kinds** (share capital vs regular contribution vs deposit vs service payment vs fine) | §3.2. The law requires the distinction; the product cannot be correct without it. |
| **Exit and refund settlement** | §3.4. Legally mandatory under Articles 63 and 92, and the single best demonstration of the explainability thesis. |
| **Annual surplus, reserves, dividends and bonuses** | §3.5. Mandatory annual cycle, touches shares and membership records. Absent from all five phases. |
| **Unallocated / suspense balance** | §5.1. Without it, several ordinary situations have no defined answer. |
| **Opening balances and historical migration** | Every real customer arrives with years of spreadsheet history, existing shares, in-flight loans. The spec never mentions it. This is usually *the* reason a system like this fails to get adopted: the switching cost is the product's real competitor. |
| **Membership application and admission** | The spec starts at "a member is a person registered in the cooperative" (§5). Somebody applies, is vetted, is admitted by a decision, and pays a share before rights attach (Article 61). None of that exists. |
| **Fines and penalties for late contribution** | Near-universal in real cooperatives and savings groups. Entirely absent. Also a money kind (§3.2). |

### 6.2 Serious

| Missing | Why it matters |
|---|---|
| **The cooperative's own cash and bank position** | Contributions arrive from members but the spec never models where the money *is* until Phase 4. A treasurer's first question is "how much do we have?" and the product cannot answer it. |
| **Suspension of member rights for non-payment** | Article 61. Related to but distinct from compliance status. |
| **Share transfer between members** | Article 64 permits it with General Assembly approval. A governance workflow with a share-ownership consequence. |
| **Contribution in kind** | Article 60(3). Significant for agricultural cooperatives. |
| **Board elections and terms of office** | Governance organs exist in law with defined terms; the spec has voting and proposals but no elections. |
| **Statutory reporting to RCA and external auditors** | Articles 103–118 create real reporting and audit duties. A product that produced RCA-ready output would have a strong commercial hook. |
| **Cycles and share-out** | Many savings groups run annual cycles ending in a distribution. The spec assumes perpetual monthly accumulation. Whether this matters depends entirely on which customer segment is chosen. |
| **Guarantor obligations as contingent liabilities** | The spec has guarantors on loan applications but never tracks what a member is on the hook for. |

### 6.3 Worth noting

Dormancy and inactive members; death and inheritance of a share; multiple concurrent
obligation types; welfare/emergency/social funds; non-financial member obligations
(meeting attendance, labour contributions in agricultural cooperatives); bank
reconciliation and cash handling with dual custody; what happens on contribution day
when the internet is down; and the offline/paper fallback generally.

---

## 7. Additions worth considering

Ideas that are not in the spec and would strengthen the product. **[analysis]**

1. **Exit settlement as a headline feature.** §3.4. Legally required, emotionally
   charged, perfectly suited to the explanation engine. "Show me exactly why my refund
   is this number" is the demo that sells the product.
2. **RCA-ready annual reporting.** If the product can produce the statutory annual
   report, balance sheet inputs and member register in the form RCA expects, it stops
   being a convenience and becomes a compliance necessity. This is probably the
   strongest available commercial wedge. **[unresearched — the exact RCA reporting
   format was not confirmed; see §12]**
3. **Signed, exportable member statements.** A member receives a statement they can
   keep, verify and produce in a dispute, independent of the platform. Converts
   "trust the system" into "verify the system", and addresses §5.3.
4. **A ten-year archive guarantee, and export on exit.** Article 82 requires ten-year
   retention; make it an explicit product promise, and make leaving safe. Trust is a
   feature in a market where people have been burned by systems that vanished.
5. **Bylaw-driven setup.** Instead of a configuration screen with thirty options, ask
   the cooperative to enter the handful of values its bylaws actually specify (share
   nominal value, minimum members, contribution amount, due date, thresholds). Frame
   configuration as *recording what the bylaws already say* — which is also how the law
   thinks about it (Articles 58(2), 60(4), 66, 99(3)).
6. **A "what changed this month" digest** to the whole membership. Cheap, and it makes
   the audit trail socially real rather than theoretically available.
7. **Meeting-first data entry.** Many cooperatives collect contributions *at a
   meeting*, in one sitting, for everyone. A screen that records a whole meeting's
   collections in one pass matches reality far better than one-member-at-a-time entry.
   This is how savings-group tools are built.
8. **Assisted mode.** §12 already allows administrator-recorded contributions. Lean
   into it: in this market the realistic model is one literate officer operating on
   behalf of everyone, with members receiving SMS confirmations rather than logging in.

---

## 8. Positioning

Given §2, MilvaLoop is entering a market with an established local generalist (COPA), a
state-owned system occupying the SACCO segment, and several regional SACCO vendors.
Competing on breadth is not available. Two positions look defensible: **[analysis]**

**Position A — "The cooperative that can explain itself."** Lean entirely into the
differentiator. Narrow: members, member money, and an explanation engine that is
better than anyone else's. Sell on disputes avoided and trust preserved. Risk: "we
explain better" is a hard thing to feel before you have used it.

**Position B — "Compliance without a bookkeeper."** Lean into §3. The 2024 law imposes
ten-year retention, international-standard accounting records, annual audited
reporting, a mandatory surplus formula, statutory reserves, member registers and
beneficial-ownership registers. Most small cooperatives cannot do this. A product that
makes an ordinary cooperative *compliant* has a buying trigger with a deadline
attached, which is worth far more than a productivity argument.

My recommendation is **B as the wedge, A as the moat.** Compliance gets the meeting and
justifies the price; explainability is why they stay and why the product is hard to
copy. The two are complementary — the audit trail that produces explanations is the
same machinery that produces defensible statutory records. **[analysis]**

On pricing: USD 39/month is roughly 50,000 RWF — about one member's monthly share in
the spec's own example. A cooperative will notice that the software costs the same as
a member. Kwara's regional anchor is ~USD 230/month for SACCOs. **[verified]** Options
worth testing: annual billing (matches the cooperative's financial year and General
Assembly budget approval under Article 94(1) — a *regular contribution for running
costs approved by the General Assembly* is literally the legal instrument that would
fund this); tiering by member count; or selling through unions and federations, which
Articles 12–23 establish as real legal entities with real responsibilities over their
members. **[analysis]**

---

## 9. Policy questions that must be answered before building

The spec's §73 list, corrected and extended by §3. Questions marked **settled** are no
longer open in Rwanda.

**Shares**
- ~~Can vote weight depend on shares?~~ **Settled: no** (Article 62).
- ~~Can shares be fractional?~~ **Settled: no** (Article 64, "indivisible").
- ~~Can shares be pledged as collateral?~~ **Settled: no, and it is criminal** (Article 64).
- How does the cooperative handle a member reaching the 10× cap (Article 60(1))? What
  does the monthly payment become at that point? **This is the most important product
  question in the document.**
- Can shares be transferred between members, and what is the General Assembly approval
  process in practice (Article 64)?
- Is contribution in kind relevant to this cooperative (Article 60(3))?

**Contributions**
- Which money kinds does this cooperative actually use — share capital, regular
  contribution, irregular contribution, deposits, service payments, fines?
- Which of these does the General Assembly approve, and which need RCA approval
  (Article 94)?
- Is the monthly minimum share capital, or a regular contribution, or both?
- Are partial contributions carried toward the period, and can members prepay?
- Is there a waiver mechanism, and who authorises it?
- Are there fines for late payment, and are they a separate money kind?

**Governance**
- ~~What is the default decision threshold?~~ **Settled: absolute majority of votes
  cast; three-quarters attendance for constitutional matters** (Article 35(3)).
- **Open and important:** can this cooperative lawfully take General Assembly decisions
  through the platform at all, given Article 35(2)'s "in person and cannot vote by
  proxy"? Needs a Rwandan legal opinion. Until then, treat the platform as *recording*
  votes, not *conducting* them.
- Does the cooperative want the member register and contribution status to be visible
  to all members?

**Exit and surplus**
- What is the exact surplus distribution formula in Articles 97–99 (the two secondary
  summaries conflict — read the gazette)?
- How is "loss incurred while a member" computed for Article 92 refunds?
- What is the practical process when a member owes more than their share is worth
  (Article 63's one-year window)?

**Loans**
- Given shares cannot secure a loan, what actually secures it — guarantors, the
  Article 63 first charge, or nothing?
- Is committee voting required, and is that committee a "specialised committee" under
  Article 52?

---

## 10. Proving the idea cheaply

Before building further, three experiments, in order. **[analysis]**

**Experiment 1 — the retrospective test (days, no code).**
Take one real cooperative's actual records for the last 12 months. By hand, try to
answer: why does this member hold this many shares; why do they owe this amount; what
would their exit refund be. If *you* cannot answer from their records, the pain is
real and specific. If you can answer easily, the pain is smaller than the spec assumes.
This also surfaces which money kinds that cooperative actually uses — which is the §3.2
question, answered by evidence rather than assumption.

**Experiment 2 — the 10-share conversation (one meeting).**
Ask a real cooperative treasurer what happens when a member has held ten shares for
two years and still pays every month. Their answer *is* the domain model. If they look
confused, that confusion is the product opportunity. If they have a crisp answer,
build that.

**Experiment 3 — the compliance interview (a few meetings).**
Ask three cooperatives what they had to produce for RCA last year, how long it took,
and what it cost them. If the answer involves paying someone, position B in §8 is
validated and has a price attached. If they shrug, the compliance wedge is weaker than
it looks and Position A must carry the product alone.

**What would kill the idea:** cooperatives that already use COPA or a bookkeeper and
consider the problem solved; treasurers who cannot articulate a single dispute in the
last two years; or an unwillingness to pay anything at all, at which point the real
customer is a union, federation or donor, not the cooperative — and the product should
be shaped for that buyer instead.

---

## 11. Principal risks

1. **Legal-model risk.** The product's core mechanic conflicts with Article 60. Fixing
   it is a domain-model change, not a patch. *Mitigation: resolve §3.2 before building
   further.* **[verified basis]**
2. **Switching-cost risk.** The competitor is not COPA; it is the spreadsheet that
   already has eight years of history in it. Nothing in the spec addresses migration.
   *Mitigation: treat opening balances as a first-class feature.*
3. **Scope risk.** 35 entities, 5 phases, one developer. The most likely failure is not
   a wrong decision but an unfinished product. *Mitigation: §5.8's cut.*
4. **Adoption risk — confirmed, not just suspected.** Rwanda's smartphone ownership
   sits at ~34%, and only ~20% of the population uses mobile internet; internet
   penetration overall is ~38% (mid-2025), with a sharp urban/rural split (57% urban vs
   19% rural). **[reported]** For the poorest households, a basic smartphone plus 1GB of
   data can consume up to 60% of monthly income. **[reported]** A web-first,
   email-first, member-facing product is very likely to go unused by most members in a
   typical cooperative. *Mitigation: assisted mode and SMS as the primary member-facing
   channel; treat member self-service web/app access as a bonus for the minority who
   have it, not the primary interaction model; do not count on member logins.*
5. **Incumbent risk.** COPA is here, positioned identically, with an app and an API.
   *Mitigation: choose the narrow, deep position deliberately.* **[verified]**
6. **Regulatory-exposure risk — bounded, not eliminated.** BNR licenses SACCOs/DTMFIs at
   a RWF 100 million paid-up capital threshold, and separately licenses standalone
   non-deposit-taking lenders at RWF 50 million; ordinary member-funded internal lending
   below that scale sits under RCA's cooperative-law supervision, not BNR licensing.
   **[reported]** *Residual risk:* whether MilvaLabs itself carries any vendor-level
   duty toward BNR when serving a cooperative that crosses into licensed-SACCO
   territory was not established. **[unresearched — see §3.10]**
7. **Data protection risk — confirmed, and urgent.** Rwanda requires personal data to be
   stored in Rwanda by default (Article 50) unless the controller holds an NCSA
   certificate authorising offshore storage; cross-border transfer is separately
   restricted (Article 48); registration with the NCSA is mandatory (free, ~30-day
   turnaround) and operating unregistered carries fines of RWF 2,000,000–5,000,000 or 1%
   of global turnover. **[reported — see §3.9]** *Mitigation: resolve NCSA registration
   and a hosting decision (Rwanda-based hosting, or the offshore certificate) before
   onboarding the first real cooperative — this is a precondition, not a
   nice-to-have.*
8. **Trust risk.** Selling integrity while operating a database you can edit. *Mitigation:
   §5.3.*

---

## 12. Known gaps in this document

An earlier version of this document flagged eleven open research areas. Most have now
been resolved with sourced findings (folded into §3.5, §3.9, §3.10, §3.11, §5, §11
above) in a second research pass. What follows is the honest remainder — either
genuinely still open, or only partially answered.

**Resolved since the first draft**, for reference — see the cited section for the
finding: data protection and hosting (§3.9); BNR supervision thresholds (§3.10);
Articles 97–99 surplus percentages, now read directly from the gazette (§3.5); Article
9 minimum member count (§3.1); IFRIC 2 equity-vs-liability treatment (§3.11); headline
adoption constraints — smartphone/internet penetration (§11, risk 4); MTN MoMo API
shape (integration pattern only, see below for what is still missing).

**Still genuinely open:**

- **Articles 103–118** (reporting, audit, external auditor duties) — identified in the
  table of contents but not read article-by-article. Needed to size Position B's
  "compliance without a bookkeeper" pitch precisely.
- **RCA's actual CMIS reporting format and frequency** — confirmed CMIS exists (§2.1)
  but not what a cooperative must actually submit through it or how often, which is
  needed to price Position B credibly.
- **Savings-group tooling** (DreamSave, Chomoka, SAVIX, Ledger Link) — cycle and
  share-out models, offline capability, evaluation evidence. Not researched in either
  pass; still relevant if the target segment leans toward informal savings groups
  rather than registered cooperatives.
- **Behavioural evidence on reminders** — effect sizes for SMS reminders on savings and
  repayment (Karlan/Ashraf/IPA-style trial evidence), to justify or discard §18's
  design. Not researched.
- **Literacy, language and USSD/SMS economics** specifically — the smartphone/internet
  penetration numbers are now sourced (§11), but Kinyarwanda/French/English
  localisation needs and USSD/SMS provider economics were not.
- **Airtel Money's API and terms** — only MTN MoMo's integration shape was confirmed
  (request-callback pattern via Collections/Disbursements APIs, sandbox-then-production
  onboarding); fees, settlement timing, and Airtel's equivalent were not researched.
- **Governance and voting practice beyond the statute** — specifically, whether
  electronic or asynchronous General Assembly voting has any precedent, guidance, or
  tolerance in Rwanda, given Article 35(2)'s "in person, no proxy" language (§3.3).
  This needs a legal opinion, not general research, and remains the single most
  important open policy question in §9.
- **Pricing and willingness to pay** in this segment beyond the single Kwara anchor
  (§2.3) — no data was found on what a small Rwandan cooperative actually budgets for
  software, or who controls that budget.
- **Whether MilvaLabs as a vendor** carries any registration or oversight duty toward
  BNR when a customer cooperative is or becomes a licensed SACCO (§3.10, §11 risk 6).

---

## 13. Sources

Primary, read directly:

- *Law n° 057/2024 of 20/06/2024 governing cooperatives in Rwanda*, **Official Gazette
  n° 28 Bis of 08/07/2024** — full text retrieved from the Ministry of Justice and read
  directly. All Article quotations in §3 are from this text.
- Apache Fineract share-account and share-product documentation (Apache Confluence and
  source), for the share model comparison in §2.4.

Official and institutional:

- Rwanda Cooperative Agency — <https://www.rca.gov.rw> (mandate, legal affairs and
  registration, CMIS, "What is new in the New Cooperative Law")
- *Law n° 48/2013* establishing the Rwanda Cooperative Agency — RwandaLII
- MINECOFIN — "Automation of 416 Umurenge SACCOs has been successfully completed"
- ICA Cooperative Law — "Rwanda's New Cooperative Law: Strengthening Governance and
  Empowering Members"

Market and vendors:

- COPA — <https://copa.rw>, <https://docs.copa.rw>, and the Google Play listing
- Kwara — <https://kwara.com> and its published pricing
- Mifos X / Apache Fineract — mifos.org, Apache project documentation
- Cyclos — cyclos.org
- Regional vendors: PayStar Africa, Finhazi, Softeye Solutions, Saccowave, Coretec,
  Mfuko Plus
- Press coverage of U-SACCO automation: KT Press, The New Times, allAfrica, Rwanda Today

Data protection, financial regulation and accounting (§3.9–§3.11):

- HLC (Hogan Lovells) — "Key features of the new Rwandan data protection law"
- DLA Piper Africa — "Deadline for mandatory registration as a data controller or
  processor to close on 15 October 2023"
- NCSA (National Cyber Security Authority) — registration guide and application forms,
  cyber.gov.rw
- Rwanda Data Protection & Privacy Office — dpo.gov.rw (FAQs, DPO designation guidance,
  breach notification form)
- National Bank of Rwanda — bnr.rw (DTMFI supervision, NDFI licensing, laws and
  regulations)
- IFRS Foundation — IFRIC 2, "Members' Shares in Co-operative Entities and Similar
  Instruments"
- MTN MoMo Developer Portal — momodeveloper.mtn.co.rw

Adoption and connectivity:

- RURA (Rwanda Utilities Regulatory Authority) — ICT Sector Statistics Report, Q1 2026
- allAfrica — "Central Africa: Rwanda Reaches 38 Percent Internet Penetration but Faces
  Cost Hurdles"
- Statista Market Forecast — Rwanda Digital Economy outlook

---

*MilvaLoop is a product of MilvaLabs.*
