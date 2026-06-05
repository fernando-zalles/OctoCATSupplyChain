# Feature Specification: Purchase Order Management

**Feature Branch**: `001-purchase-order-management`

**Created**: 2026-06-04

**Status**: Draft

**Input**: User description: "Create a Purchase Order management system. Buyers at branches can create purchase orders to suppliers for products. Each PO contains multiple line items with quantities and expected prices. Track PO status (Draft, Submitted, Approved, Fulfilled, Cancelled). Suppliers receive notifications when POs are submitted. Include approval workflow for POs over $10,000."

## Clarifications

### Session 2026-06-04

- Q: Can a user hold both the Buyer and Approver roles simultaneously? → A: Yes — roles can overlap. A user holding both roles may approve other users' POs but CANNOT approve their own POs.
- Q: Can a buyer cancel a PO that is already in Approved status? → A: No — buyers may cancel only their own Draft or Submitted POs. Only approvers may cancel Approved POs.
- Q: When should the supplier be notified — at submission, at approval, or both? → A: Both — one notification when the PO is submitted (pending signal) and a second when it reaches Approved status (confirmed signal).
- Q: If the notification service is unavailable, should the PO status transition be blocked or proceed? → A: Proceed with the status transition; record the notification as pending and retry delivery asynchronously.
- Q: Should the audit trail capture line item edits during Draft status, or only PO status transitions? → A: Status transitions only — record actor, timestamp, from-status, to-status, and optional reason for every state change; line item edits during Draft are not audited.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Buyer Creates and Submits a Purchase Order (Priority: P1)

A buyer at a branch selects a supplier and adds one or more line items (products,
quantities, expected unit prices) to a new purchase order. Once satisfied, the buyer
submits the PO. If the PO total is under $10,000 it moves directly to Approved status.
The supplier receives a notification that a PO has been submitted.

**Why this priority**: This is the core workflow — without it no other story is
possible. It delivers immediate value: branches can digitally communicate procurement
needs to suppliers.

**Independent Test**: Create a PO with two line items totalling $4,500, submit it, and
verify the PO status becomes Approved and the supplier notification is recorded.

**Acceptance Scenarios**:

1. **Given** a buyer is logged in at a branch, **When** they create a new PO for
   Supplier A with two line items (Widget × 10 @ $50, Gadget × 5 @ $200) and submit
   it, **Then** the PO status is Approved, total is $1,500, and a combined
   submitted-and-approved notification is generated for Supplier A.
2. **Given** a buyer has a PO in Draft status, **When** they attempt to submit it with
   zero line items, **Then** submission is rejected with a clear validation error.
3. **Given** a submitted PO, **When** the buyer tries to edit line items, **Then** the
   edit is rejected because only Draft POs are editable.

---

### User Story 2 - Approval Workflow for High-Value POs (Priority: P2)

When a buyer submits a PO whose total is $10,000 or more, the PO enters a Submitted
status awaiting approval from an authorised approver. The approver reviews the PO and
either approves or rejects it. A rejected PO returns to Draft so the buyer can revise
and resubmit.

**Why this priority**: Financial controls require that large purchases receive human
review before being actioned. This is a compliance requirement, not a convenience
feature.

**Independent Test**: Submit a PO totalling $15,000. Verify status is Submitted (not
Approved). Log in as an approver, approve the PO, verify status becomes Approved and
supplier is notified. Then submit a second $15,000 PO, reject it, and verify it
returns to Draft.

**Acceptance Scenarios**:

1. **Given** a buyer submits a PO totalling exactly $10,000, **When** the submission
   completes, **Then** the PO status is Submitted (pending approval) and a "pending"
   notification is sent to the supplier.
2. **Given** a PO in Submitted status, **When** an approver approves it, **Then** the
   PO status changes to Approved and the supplier receives a second "confirmed"
   notification.
3. **Given** a PO in Submitted status, **When** an approver rejects it, **Then** the
   PO status returns to Draft and the buyer is notified of the rejection.
4. **Given** a user with only the Buyer role viewing a Submitted PO, **When** they
   attempt to approve it, **Then** the action is denied with an authorisation error.
5. **Given** a user with both Buyer and Approver roles who created a PO now in
   Submitted status, **When** they attempt to approve their own PO, **Then** the action
   is denied with a self-approval error.

---

### User Story 3 - Supplier Marks PO as Fulfilled (Priority: P3)

A supplier views the purchase orders addressed to them and marks an Approved PO as
Fulfilled once goods have been dispatched or delivered. The buyer at the originating
branch can see the updated status.

**Why this priority**: Closing the loop on fulfilment is important for inventory
planning but is secondary to the procurement creation and approval flows.

**Independent Test**: Given an Approved PO for Supplier A, log in as Supplier A, mark
it Fulfilled, and verify the PO status is Fulfilled and the buyer's branch can see the
update.

**Acceptance Scenarios**:

1. **Given** an Approved PO for Supplier A, **When** Supplier A marks it as Fulfilled,
   **Then** the PO status becomes Fulfilled and a timestamp is recorded.
2. **Given** a PO in Draft or Submitted status, **When** a supplier attempts to mark it
   Fulfilled, **Then** the action is rejected.
3. **Given** a Fulfilled PO, **When** a buyer views their branch PO list, **Then** the
   PO appears with Fulfilled status and fulfilment date.

---

### User Story 4 - Cancel a Purchase Order (Priority: P4)

A buyer can cancel their own PO while it is in Draft or Submitted status. An approver
can cancel any PO in Draft, Submitted, or Approved status. A cancellation reason is
required. Cancelled POs are read-only.

**Why this priority**: Procurement plans change; buyers must be able to stop a PO
before goods are dispatched, and approvers must be able to rescind an approved
commitment if circumstances change.

**Independent Test**: As a buyer, cancel a Draft PO and a Submitted PO — both succeed.
Attempt to cancel an Approved PO as a buyer — rejected. As an approver, cancel an
Approved PO — succeeds. Verify all cancelled POs are read-only.

**Acceptance Scenarios**:

1. **Given** a buyer views their own PO in Draft or Submitted status, **When** they
   cancel it with a reason, **Then** the PO status becomes Cancelled and the reason is
   stored.
2. **Given** a buyer views their own PO in Approved status, **When** they attempt to
   cancel it, **Then** the action is rejected with an authorisation error.
3. **Given** an approver views any PO in Draft, Submitted, or Approved status, **When**
   they cancel it with a reason, **Then** the PO status becomes Cancelled and the reason
   is stored.
4. **Given** a Fulfilled PO, **When** any user attempts to cancel it, **Then** the
   action is rejected.
5. **Given** a Cancelled PO, **When** a user views it, **Then** all fields are
   read-only and the cancellation reason is visible.

---

### Edge Cases

- What happens when a buyer changes line item prices after the PO is created but before
  submission, causing the total to cross the $10,000 threshold?
  → The threshold check is applied at submission time only; the current total at the
  moment of submission determines the workflow path.
- How does the system handle a supplier that is no longer active when a PO is
  submitted?
  → Submission is blocked with a validation error until a valid active supplier is
  selected.
- What if two approvers try to approve or reject the same PO simultaneously?
  → The first action wins; the second receives an error indicating the PO is no longer
  in Submitted status.
- What happens when a PO line item references a product that has been discontinued?
  → Validation at submission time rejects the PO and identifies the discontinued
  product(s).
- Can a PO have zero line items submitted?
  → No. Submission requires at least one line item with a quantity ≥ 1 and a price > 0.
- What happens if the notification service is unavailable when a PO is submitted or
  approved?
  → The PO status transition proceeds. The system records the notification with a
  pending delivery status and hands it off asynchronously. The PO workflow is never
  blocked by notification failures.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow buyers to create a Purchase Order in Draft status,
  selecting one supplier and their branch.
- **FR-002**: System MUST allow buyers to add, edit, and remove line items (product,
  quantity, expected unit price) from a Draft PO.
- **FR-003**: System MUST calculate and display the PO total (sum of quantity ×
  expected unit price across all line items).
- **FR-004**: System MUST prevent submission of a PO with no line items, any line item
  with quantity < 1, or any line item with price ≤ 0.
- **FR-005**: System MUST allow buyers to submit a Draft PO, triggering status
  transition based on total value.
- **FR-006**: System MUST automatically approve POs with a total below $10,000 upon
  submission (Draft → Approved).
- **FR-007**: System MUST place POs with a total of $10,000 or more into Submitted
  status awaiting approver action (Draft → Submitted).
- **FR-008a**: System MUST notify the supplier when a PO is submitted (i.e., transitions
  out of Draft), indicating the PO is pending approval or auto-approved.
- **FR-008b**: System MUST notify the supplier when a PO reaches Approved status
  (whether auto-approved or manually approved), indicating the PO is a confirmed
  commitment. For auto-approved POs (total < $10,000) FR-008a and FR-008b notifications
  may be combined into a single "approved" notification since the transition is
  instantaneous.
- **FR-008c**: PO status transitions MUST NOT be blocked by notification delivery
  failures. The system MUST record each notification with a pending delivery status and
  hand it off to the notification service asynchronously. If delivery fails, the
  notification MUST be retried; the retry strategy is owned by the notification service.
- **FR-009**: System MUST allow authorised approvers to approve a Submitted PO
  (Submitted → Approved).
- **FR-010**: System MUST allow authorised approvers to reject a Submitted PO
  (Submitted → Draft), recording the rejection reason and notifying the buyer.
- **FR-011**: System MUST prevent users without the Approver role from performing
  approval or rejection actions. A user holding both the Buyer and Approver roles MUST
  NOT be permitted to approve or reject a PO they themselves created.
- **FR-012**: System MUST allow suppliers to mark an Approved PO as Fulfilled
  (Approved → Fulfilled), recording a fulfilment timestamp.
- **FR-013**: System MUST allow buyers to cancel their own POs in Draft or Submitted
  status (→ Cancelled), requiring a cancellation reason. System MUST allow approvers to
  cancel any PO in Draft, Submitted, or Approved status (→ Cancelled), requiring a
  cancellation reason.
- **FR-014**: System MUST prevent any status change on a Fulfilled or Cancelled PO
  except viewing.
- **FR-015**: System MUST provide buyers with a list of POs for their branch, filterable
  by status.
- **FR-016**: System MUST provide suppliers with a list of POs addressed to them,
  filterable by status.
- **FR-017**: System MUST provide approvers with a queue of POs pending approval.

### Key Entities *(include if feature involves data)*

- **Purchase Order (PO)**: The procurement request. Key attributes: unique identifier,
  branch, supplier, status, total value, created date, submitted date, approval date,
  fulfilment date, cancellation reason, rejection reason.
- **PO Line Item**: A single product request within a PO. Key attributes: product
  reference, quantity, expected unit price, line total. Belongs to exactly one PO.
- **Buyer**: A user associated with a branch who can create and submit POs.
- **Approver**: A user authorised to approve or reject high-value POs (organisation-wide
  authority). A user may hold both Buyer and Approver roles simultaneously but MUST NOT
  approve or reject their own POs.
- **Supplier**: An external entity that receives POs and fulfils them.
- **Branch**: An organisational unit (physical location or cost centre) that buyers
  belong to.
- **Product**: A purchasable item. Has active/discontinued status.
- **Notification**: A record that a supplier or buyer was informed of a PO status
  change. Attributes: recipient, PO reference, event type (submitted-pending /
  approved-confirmed / rejected / cancelled), timestamp, delivery status
  (pending / delivered / failed), retry count.
- **PO Audit Entry**: An immutable record of a single PO status transition. Attributes:
  PO reference, actor (user), from-status, to-status, timestamp, reason (optional;
  required for rejection and cancellation).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A buyer can create, populate, and submit a purchase order in under
  3 minutes for a PO with up to 10 line items.
- **SC-002**: Supplier notifications (both the submission pending signal and the
  approval confirmed signal) are generated within 30 seconds of the triggering status
  transition.
- **SC-003**: Approvers can review and action a pending PO in under 2 minutes from
  their approval queue.
- **SC-004**: 100% of POs have a complete audit trail covering every status transition,
  recording the actor, timestamp, from-status, to-status, and reason (where applicable).
  Line item edits during Draft status are not required to be audited.
- **SC-005**: The system correctly enforces the $10,000 approval threshold with zero
  exceptions — no PO at or above that value reaches Approved status without an
  approver action.
- **SC-006**: Buyers can retrieve their branch's full PO history (any status) without
  pagination delays exceeding 2 seconds for up to 10,000 POs.

## Assumptions

- Users (buyers, approvers, suppliers) are already authenticated by an existing
  identity system; this feature does not implement authentication.
- Role assignment (Buyer, Approver, Supplier) is managed externally; this feature
  reads roles but does not manage them.
- A single buyer can belong to only one branch.
- Supplier notification delivery mechanism (email, webhook, in-app) is out of scope for
  this feature; the system records the notification intent and delivery is handled by
  an existing notification service.
- Products and suppliers already exist in the system; this feature does not implement
  product or supplier management.
- The $10,000 threshold applies to the PO total in the organisation's base currency;
  multi-currency support is out of scope for this feature.
- An approver may approve POs from any branch (organisation-wide authority). A user may
  hold both Buyer and Approver roles; when doing so they cannot approve or reject their
  own POs.
- A buyer may cancel their own Draft or Submitted POs; an approver may cancel any
  PO in Draft, Submitted, or Approved status.
- Mobile support is out of scope for v1; the system targets web browsers.
