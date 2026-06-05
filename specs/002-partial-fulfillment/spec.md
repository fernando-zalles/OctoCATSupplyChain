# Feature Specification: Partial Fulfilment

**Feature Branch**: `002-partial-fulfillment`

**Created**: 2026-06-04

**Status**: Draft

**Input**: User description: "Update the Purchase Order spec to support partial fulfillment: line items can be fulfilled in multiple shipments, track fulfillment history per line item, PO status is 'Partially Fulfilled' until all items complete, add GET /api/purchase-orders/:id/fulfillment-history endpoint."

## Clarifications

### Session 2026-06-04

- Q: What is the unit of a partial fulfilment record — is it a quantity against a specific line item, or a shipment that covers multiple line items at once? → A: A shipment record targets a specific line item and records the quantity fulfilled in that delivery. A single physical shipment may generate one record per line item it covers.
- Q: When a supplier records a partial fulfilment, can the quantity exceed the line item's ordered quantity (over-delivery)? → A: Over-delivery is not permitted. The quantity fulfilled in any single shipment, plus all previously fulfilled quantities for that line item, must not exceed the ordered quantity.
- Q: Should the "Partially Fulfilled" status be a new formal PO status alongside Draft/Submitted/Approved/Fulfilled/Cancelled, or a derived display state computed from line item progress? → A: It is a formal PO status stored on the record, making it queryable and auditable like the existing statuses.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Supplier Records a Partial Shipment Against a Line Item (Priority: P1)

A supplier views an Approved PO and records a partial delivery against one or more
line items. Each record captures the quantity shipped and the shipment reference. After
recording, the PO transitions to Partially Fulfilled if at least one line item is
incomplete. The buyer can see the updated status and the fulfilment progress per line
item.

**Why this priority**: This is the foundation of the feature. Without the ability to
record partial deliveries, all other stories have no data to display or act on.

**Independent Test**: Given an Approved PO with two line items (10 units each), record
a shipment of 4 units against line item 1. Verify the PO status becomes Partially
Fulfilled, line item 1 shows 4/10 fulfilled, and line item 2 shows 0/10 fulfilled.

**Acceptance Scenarios**:

1. **Given** an Approved PO, **When** a supplier records a shipment of 4 units against
   line item 1 (ordered qty 10), **Then** line item 1 shows 4 units fulfilled, the PO
   status becomes Partially Fulfilled, and the fulfilment event is recorded in history.
2. **Given** a Partially Fulfilled PO, **When** a supplier records a second shipment of
   6 units against line item 1 (completing it) while line item 2 remains at 0, **Then**
   line item 1 shows 10/10 fulfilled, PO status remains Partially Fulfilled.
3. **Given** a supplier recording a shipment, **When** the quantity would cause the
   total fulfilled for that line item to exceed the ordered quantity, **Then** the
   submission is rejected with a clear over-delivery error.
4. **Given** a PO in Draft, Submitted, or Cancelled status, **When** a supplier
   attempts to record a shipment, **Then** the action is rejected.

---

### User Story 2 - PO Transitions to Fully Fulfilled When All Line Items Complete (Priority: P2)

When a supplier records a shipment that completes the last outstanding line item
quantity, the PO automatically transitions from Partially Fulfilled to Fulfilled.

**Why this priority**: Closing the fulfilment loop accurately is a compliance and
inventory requirement. The PO must not remain in Partially Fulfilled once all goods
have been received.

**Independent Test**: Given a Partially Fulfilled PO with one line item at 8/10 units,
record the remaining 2 units. Verify the PO status becomes Fulfilled and the
fulfilment completion is recorded in the audit trail.

**Acceptance Scenarios**:

1. **Given** a Partially Fulfilled PO where all line items reach their ordered quantity
   after a shipment, **When** the final shipment is recorded, **Then** the PO status
   becomes Fulfilled and a completion audit entry is created.
2. **Given** a Fulfilled PO, **When** a supplier attempts to record another shipment,
   **Then** the action is rejected because no outstanding quantities remain.

---

### User Story 3 - View Fulfilment History for a PO (Priority: P3)

A buyer or approver views the complete fulfilment history for a PO: each shipment
event shows which line item was affected, the quantity shipped, the shipment reference,
who recorded it, and when.

**Why this priority**: Visibility into the delivery timeline is essential for
reconciliation, dispute resolution, and inventory planning.

**Independent Test**: Given a PO with three fulfilment events across two line items,
retrieve the fulfilment history and verify all three events appear in chronological
order with correct quantities and references.

**Acceptance Scenarios**:

1. **Given** a PO with multiple partial shipment records, **When** a buyer retrieves
   the fulfilment history, **Then** all shipment events are returned in chronological
   order with line item reference, quantity, shipment reference, actor, and timestamp.
2. **Given** a PO with no shipment records, **When** the fulfilment history is
   retrieved, **Then** an empty list is returned (not an error).
3. **Given** a user without access to the PO (e.g., a supplier for a different
   supplier's PO), **When** they attempt to retrieve the fulfilment history, **Then**
   the request is rejected with an authorisation error.

---

### Edge Cases

- What if the same shipment reference is submitted twice for the same line item?
  → The system accepts it; shipment references are informational and not enforced as
  unique. Duplicate submissions are the supplier's responsibility to avoid.
- What if a line item is removed from a PO after partial fulfilment has been recorded?
  → Line items cannot be removed once the PO has been submitted. Partial fulfilment
  records are therefore always associated with a valid line item.
- What happens to fulfilment history when a PO is cancelled?
  → Existing fulfilment records are preserved for audit purposes. No new records can
  be added to a Cancelled PO.
- Can a buyer or approver record a shipment on behalf of a supplier?
  → No. Only users with the Supplier role may record shipment events.
- What if a PO has zero line items at the point of partial fulfilment (edge case from
  concurrent edit)?
  → This cannot occur: POs must have at least one line item to be submitted, and line
  items are immutable post-submission.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-101**: System MUST allow suppliers to record a partial shipment against a
  specific line item on an Approved or Partially Fulfilled PO, specifying the quantity
  fulfilled and an optional shipment reference.
- **FR-102**: System MUST reject any shipment record where the quantity, combined with
  all previously fulfilled quantities for that line item, would exceed the ordered
  quantity.
- **FR-103**: System MUST transition the PO status to Partially Fulfilled when at least
  one shipment has been recorded but at least one line item still has outstanding
  quantity.
- **FR-104**: System MUST transition the PO status to Fulfilled when a shipment
  completes the last outstanding quantity across all line items.
- **FR-105**: System MUST record each shipment event in a per-PO fulfilment history,
  capturing: line item reference, quantity fulfilled in this shipment, cumulative
  quantity fulfilled for that line item, shipment reference (optional), actor, and
  timestamp.
- **FR-106**: System MUST expose the fulfilment history for a PO via a dedicated read
  endpoint accessible to buyers, approvers, and the PO's supplier.
- **FR-107**: System MUST display per-line-item fulfilment progress (fulfilled quantity
  vs. ordered quantity) on the PO detail view.
- **FR-108**: System MUST prevent any new shipment records on a PO in Fulfilled,
  Cancelled, Draft, or Submitted status.
- **FR-109**: System MUST add Partially Fulfilled as a formal, queryable PO status
  alongside the existing statuses.
- **FR-110**: System MUST include Partially Fulfilled POs in the supplier's PO list
  view so outstanding deliveries remain visible.

### Key Entities *(include if feature involves data)*

- **Fulfilment Record**: A single shipment event against one line item. Attributes:
  PO reference, line item reference, quantity fulfilled in this shipment, cumulative
  quantity fulfilled for this line item after this shipment, shipment reference
  (optional free-text), actor (supplier user), timestamp.
- **PO Line Item** *(extended)*: Gains a derived attribute — fulfilled quantity — which
  is the sum of all fulfilment record quantities for that line item.
- **PO Status** *(extended)*: The value set `{draft, submitted, approved,
  partially-fulfilled, fulfilled, cancelled}` replaces the previous set by inserting
  Partially Fulfilled between Approved and Fulfilled.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-101**: Suppliers can record a partial shipment against a line item in under
  60 seconds, including selecting the line item, entering quantity, and confirming.
- **SC-102**: The PO status (Partially Fulfilled vs. Fulfilled) is computed and stored
  correctly in 100% of shipment submissions — no manual reconciliation required.
- **SC-103**: Buyers can retrieve the full fulfilment history for any PO in under
  2 seconds, regardless of the number of shipment events (up to 1,000 per PO).
- **SC-104**: Over-delivery is rejected in 100% of cases — no line item can show a
  fulfilled quantity greater than its ordered quantity.
- **SC-105**: Partially Fulfilled POs are visible in the supplier's PO list, ensuring
  zero outstanding deliveries are invisible to the responsible supplier.

## Assumptions

- This feature extends the existing Purchase Order management system; all existing
  statuses, actors, and workflows remain valid unless explicitly modified here.
- The Partially Fulfilled status is inserted into the state machine between Approved
  and Fulfilled. The existing direct Approved → Fulfilled transition (from the original
  full-fulfilment flow) is replaced by a shipment-by-shipment model; a PO can only
  reach Fulfilled by completing all line items through one or more shipment records.
- A supplier may record multiple shipment events in any order and in any session; there
  is no requirement to complete line items in the order they appear on the PO.
- Shipment references are free-text strings (e.g., tracking numbers, delivery note
  numbers) provided by the supplier. The system does not validate their format or
  uniqueness.
- Fulfilment records are immutable once created; there is no edit or delete capability
  for individual shipment records. If a supplier records an incorrect quantity, the
  resolution process is out of scope for this feature.
- The fulfilment history endpoint is read-only and available to buyers, approvers, and
  the PO's assigned supplier. Other users (e.g., suppliers not assigned to this PO)
  cannot access the history.
- Mobile support remains out of scope for v1.
